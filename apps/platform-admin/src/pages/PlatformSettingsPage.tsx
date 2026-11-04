import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, History, RefreshCw, RotateCcw } from "lucide-react";
import { Alert, Button, Tabs, TabsContent, TabsList, TabsTrigger, buttonVariants } from "@store-builder/ui";
import { SocialLinks, visibleSocialLinks, type SocialLinkConfig } from "@store-builder/ui/social-links";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextAreaField, TextField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { fmt, getIntlLocale, useLocale, useT } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { P, PAYMENT_METHODS_PAGE } from "@/lib/permissions";
import * as api from "@/lib/platformSettingsApi";
import {
  SETTINGS_GROUPS,
  type HistoryEntry,
  type Localized,
  type PlatformSettingsState,
  type SettingsGroup,
  type SettingsValues,
  type SocialLinkSetting,
} from "@/lib/platformSettingsApi";
import { changedFields, socialRows, validateGroup, type FieldError, type FieldErrors, type FormRules } from "@/lib/platformSettingsForm";
import { PLATFORM_NAMES, PLATFORM_SETTINGS_STRINGS, type PlatformSettingsStrings } from "@/lib/platformSettingsStrings";

type Tab = SettingsGroup | "payment";
const TABS: Tab[] = [...SETTINGS_GROUPS, "payment"];
type Drafts = { [G in SettingsGroup]?: SettingsValues[G] };

/** The value the form edits: the social list gets every platform the API accepts, the ones not listed off. */
function formValue<G extends SettingsGroup>(group: G, value: SettingsValues[G], state: PlatformSettingsState): SettingsValues[G] {
  if (group !== "social") return value;
  return { links: socialRows((value as SettingsValues["social"]).links, state.rules.socialPlatforms) } as SettingsValues[G];
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(getIntlLocale(), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * The console's "Platform settings": ZIMOS's own details on zimos.co, on the
 * merchants' support page and in the system emails, one tab per group, each
 * saved whole after a confirmation, put back to the defaults, or set back to
 * an earlier value from its history. The API (modules/platformSettings) checks
 * and audits everything; this page checks first so a mistake shows on its
 * field.
 */
export function PlatformSettingsPage() {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  const { can } = useAuth();
  const canManage = can(P.PLATFORM_SETTINGS_MANAGE);
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && TABS.includes(asked) ? asked : "contact";
  const { data, loading, error, refresh, setData } = useAsync(api.getState, []);
  const [drafts, setDrafts] = useState<Drafts>({});

  function applied<G extends SettingsGroup>(result: api.SaveResult<G>) {
    const { group, value, source, updatedAt, updatedBy } = result;
    setData((prev) => {
      const base = prev as PlatformSettingsState;
      return { ...base, groups: { ...base.groups, [group]: { value, source, updatedAt, updatedBy } } };
    });
    setDrafts((prev) => ({ ...prev, [result.group]: undefined }));
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh({ silent: true })} disabled={loading}>
            <RefreshCw /> {t.refresh}
          </Button>
        }
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-4">
            {!data.enabled && <Alert>{t.off}</Alert>}
            {!canManage && <Alert>{t.readOnly}</Alert>}
            <Tabs value={tab} onValueChange={(v) => setParams({ tab: String(v) }, { replace: true })}>
              <div className="scroll-thin overflow-x-auto border-b border-line">
                <TabsList variant="line" className="h-10" aria-label={t.tabsLabel}>
                  {TABS.map((key) => (
                    <TabsTrigger key={key} value={key}>
                      {t[`tab_${key}`]}
                      {key !== "payment" && isDirty(key, drafts, data) && (
                        <>
                          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                          <span className="sr-only">({t.unsaved})</span>
                        </>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {SETTINGS_GROUPS.map((group) => (
                <TabsContent key={group} value={group} className="pt-5">
                  <GroupEditor
                    group={group}
                    state={data}
                    draft={drafts[group]}
                    companyName={(drafts.company ?? data.groups.company.value).platformName}
                    contactEmail={(drafts.contact ?? data.groups.contact.value).supportEmail}
                    socialLinks={(drafts.social ?? data.groups.social.value).links}
                    canManage={canManage}
                    onChange={(value) => setDrafts((prev) => ({ ...prev, [group]: value }))}
                    onDiscard={() => setDrafts((prev) => ({ ...prev, [group]: undefined }))}
                    onApplied={applied}
                  />
                </TabsContent>
              ))}
              <TabsContent value="payment" className="pt-5">
                <PaymentAccountPanel />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DataState>
    </div>
  );
}

function isDirty(group: SettingsGroup, drafts: Drafts, state: PlatformSettingsState): boolean {
  const draft = drafts[group];
  if (draft === undefined) return false;
  return changedFields(formValue(group, state.groups[group].value, state), draft).length > 0;
}

function GroupEditor<G extends SettingsGroup>({
  group,
  state,
  draft,
  companyName,
  contactEmail,
  socialLinks,
  canManage,
  onChange,
  onDiscard,
  onApplied,
}: {
  group: G;
  state: PlatformSettingsState;
  draft: SettingsValues[G] | undefined;
  companyName: string;
  contactEmail: string;
  socialLinks: SocialLinkSetting[];
  canManage: boolean;
  onChange: (value: SettingsValues[G]) => void;
  onDiscard: () => void;
  onApplied: (result: api.SaveResult<G>) => void;
}) {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  const toast = useToast();
  const saved = state.groups[group];
  const initial = useMemo(() => formValue(group, saved.value as SettingsValues[G], state), [group, saved.value, state]);
  const value = draft ?? initial;
  const fields = changedFields(initial, value);
  const dirty = fields.length > 0;
  const rules: FormRules = state.rules;
  const errors = useMemo(() => validateGroup(group, value, rules), [group, value, rules]);
  const hasErrors = Object.keys(errors).length > 0;
  const [confirm, setConfirm] = useState<"save" | "reset" | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const groupName = t[`tab_${group}`];

  const done = (result: api.SaveResult<G>, message: string) => {
    onApplied(result);
    setHistoryVersion((v) => v + 1);
    toast.success(result.changed ? message : t.unchangedToast);
  };

  async function save() {
    done(await withFieldMessages(api.saveGroup(group, value)), t.savedToast);
    setConfirm(null);
  }

  async function reset() {
    done(await withFieldMessages(api.resetGroup(group)), t.resetToast);
    setConfirm(null);
  }

  function askToSave() {
    if (hasErrors) {
      toast.error(t.fixErrors);
      return;
    }
    setConfirm("save");
  }

  const status =
    saved.source === "saved"
      ? saved.updatedBy
        ? fmt(t.savedBy, { when: when(saved.updatedAt), who: saved.updatedBy.name || saved.updatedBy.email })
        : fmt(t.savedAt, { when: when(saved.updatedAt) })
      : t.neverSaved;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title={groupName}
          description={status}
          actions={
            <>
              {dirty && <StatusBadge tone="warning" dot>{t.unsaved}</StatusBadge>}
              <StatusBadge tone={saved.source === "saved" ? "success" : "neutral"}>{saved.source === "saved" ? t.sourceSaved : t.sourceDefault}</StatusBadge>
            </>
          }
        >
          {/* Read-only for an account that can't save: the values show, the controls that change them don't. */}
          <fieldset disabled={!canManage} className="space-y-4 [&:disabled_button]:hidden">
            <legend className="sr-only">{groupName}</legend>
            <GroupFields group={group} value={value} errors={errors} rules={rules} onChange={onChange} />
          </fieldset>
          {canManage && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button onClick={askToSave} disabled={!dirty}>
                {t.save}
              </Button>
              {dirty && (
                <Button variant="outline" onClick={onDiscard}>
                  {t.discard}
                </Button>
              )}
              {saved.source === "saved" && (
                <Button variant="ghost" className="ms-auto" onClick={() => setConfirm("reset")}>
                  <RotateCcw /> {t.resetDefaults}
                </Button>
              )}
            </div>
          )}
        </Panel>
        <Panel title={t.preview} description={t.previewHint}>
          <GroupPreview group={group} value={value} companyName={companyName} contactEmail={contactEmail} socialLinks={socialLinks} />
        </Panel>
      </div>

      <HistoryPanel group={group} version={historyVersion} canManage={canManage} onApplied={(result) => done(result, t.revertedToast)} />

      <ConfirmDialog
        open={confirm === "save"}
        title={fmt(t.confirmSaveTitle, { group: groupName })}
        description={fmt(state.enabled ? t.confirmSaveBody : t.confirmSaveOff, { fields: fields.map((f) => fieldLabel(t, f)).join(t.listSeparator) })}
        confirmLabel={t.save}
        cancelLabel={t.cancel}
        busyLabel={t.saving}
        onCancel={() => setConfirm(null)}
        onConfirm={save}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        title={fmt(t.confirmResetTitle, { group: groupName })}
        description={t.confirmResetBody}
        confirmLabel={t.resetDefaults}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={reset}
      />
    </div>
  );
}

/**
 * The API's refusal with its field messages (`address.ar: must not be empty`,
 * `hours.ar: looks like a secret…`), so the dialog says what to fix rather
 * than "Invalid body".
 */
async function withFieldMessages<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (err) {
    const details = err instanceof ApiError && Array.isArray(err.details) ? (err.details as Array<{ field?: string; message?: string }>) : [];
    const lines = details.filter((d) => d && d.message).map((d) => (d.field ? `${d.field}: ${d.message}` : String(d.message)));
    throw lines.length > 0 ? new Error(`${getErrorMessage(err)} — ${lines.join("; ")}`) : err;
  }
}

/** A field's name for the confirmation and the history; an unknown one shows as the API names it. */
function fieldLabel(t: PlatformSettingsStrings, field: string): string {
  const labels: Record<string, string> = {
    supportEmail: t.supportEmail,
    phone: t.phone,
    address: t.address,
    hours: t.hours,
    links: t.tab_social,
    platformName: t.platformName,
    legalName: t.legalName,
    registration: t.registration,
    taxRegistration: t.taxRegistration,
    tagline: t.tagline,
    rights: t.rights,
    senderName: t.senderName,
    signature: t.signature,
    footer: `${t.showSupportEmail} / ${t.showSocialLinks}`,
  };
  return labels[field] ?? field;
}

function useErrorText() {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  return (error: FieldError | undefined) => (error ? fmt(t[error.key], Object.fromEntries(Object.entries(error.params ?? {}).map(([k, v]) => [k, String(v)]))) : undefined);
}

function LocalizedFields({
  label,
  path,
  value,
  errors,
  max,
  multiline = false,
  hint,
  onChange,
}: {
  label: string;
  path: string;
  value: Localized;
  errors: FieldErrors;
  max: number;
  multiline?: boolean;
  hint?: string;
  onChange: (value: Localized) => void;
}) {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  const errorText = useErrorText();
  const field = (lang: "ar" | "en") => {
    const common = {
      label: `${label} — ${lang === "ar" ? t.arabic : t.english}`,
      dir: lang === "ar" ? "rtl" : "ltr",
      lang,
      value: value[lang],
      maxLength: max,
      error: errorText(errors[`${path}.${lang}`]),
    } as const;
    return multiline ? (
      <TextAreaField key={lang} {...common} rows={4} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} />
    ) : (
      <TextField key={lang} {...common} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} />
    );
  };
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{BOTH.map(field)}</div>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function GroupFields<G extends SettingsGroup>({
  group,
  value,
  errors,
  rules,
  onChange,
}: {
  group: G;
  value: SettingsValues[G];
  errors: FieldErrors;
  rules: FormRules;
  onChange: (value: SettingsValues[G]) => void;
}) {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  const errorText = useErrorText();
  const max = (name: string, fallback: number) => rules.limits[name] ?? fallback;
  const set = <K extends keyof SettingsValues[G]>(key: K, next: SettingsValues[G][K]) => onChange({ ...value, [key]: next });

  if (group === "contact") {
    const v = value as SettingsValues["contact"];
    const setC = set as <K extends keyof SettingsValues["contact"]>(key: K, next: SettingsValues["contact"][K]) => void;
    return (
      <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t.supportEmail} type="email" dir="ltr" value={v.supportEmail} maxLength={max("email", 254)} error={errorText(errors.supportEmail)} onChange={(e) => setC("supportEmail", e.target.value)} required />
          <TextField label={t.phone} type="tel" dir="ltr" value={v.phone} maxLength={40} hint={t.phoneHint} error={errorText(errors.phone)} onChange={(e) => setC("phone", e.target.value)} required />
        </div>
        <LocalizedFields label={t.address} path="address" value={v.address} errors={errors} max={max("address", 200)} onChange={(next) => setC("address", next)} />
        <LocalizedFields label={t.hours} path="hours" value={v.hours} errors={errors} max={max("hours", 80)} onChange={(next) => setC("hours", next)} />
      </>
    );
  }

  if (group === "social") {
    const rows = (value as SettingsValues["social"]).links;
    const setRows = (links: SocialLinkSetting[]) => onChange({ links } as SettingsValues[G]);
    const move = (index: number, step: -1 | 1) => {
      const next = [...rows];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      setRows(next);
    };
    return (
      <>
        <p className="text-sm text-ink-soft">{t.socialHint}</p>
        <ol className="divide-y divide-line rounded-[0.875rem] ring-1 ring-line">
          {rows.map((row, index) => {
            const name = PLATFORM_NAMES[row.platform] ?? row.platform;
            const domains = rules.socialDomains[row.platform];
            return (
              <li key={row.platform} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                <div className="flex shrink-0 items-center gap-1 sm:w-36 sm:pt-7">
                  <span className="text-sm font-medium text-ink">{name}</span>
                </div>
                <TextField
                  className="min-w-0 flex-1"
                  label={fmt(t.linkUrl, { name })}
                  dir="ltr"
                  type={row.platform === "email" ? "text" : "url"}
                  placeholder={row.platform === "email" ? "mailto:" : row.platform === "whatsapp" ? "https://wa.me/20…" : "https://"}
                  value={row.url ?? ""}
                  maxLength={max("url", 500)}
                  hint={domains ? fmt(t.allowedDomains, { domains: domains.join(", ") }) : undefined}
                  error={errorText(errors[`links.${row.platform}`])}
                  onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, url: e.target.value } : r)))}
                />
                <div className="flex shrink-0 items-center gap-1 sm:pt-7">
                  <Toggle
                    checked={row.enabled}
                    label={fmt(t.linkOn, { name })}
                    hideLabel
                    onChange={(enabled) => setRows(rows.map((r, i) => (i === index ? { ...r, enabled } : r)))}
                  />
                  <Button size="sm" variant="ghost" aria-label={fmt(t.moveUp, { name })} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={fmt(t.moveDown, { name })} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      </>
    );
  }

  if (group === "company") {
    const v = value as SettingsValues["company"];
    const setC = set as <K extends keyof SettingsValues["company"]>(key: K, next: SettingsValues["company"][K]) => void;
    return (
      <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t.platformName} value={v.platformName} maxLength={max("platformName", 60)} hint={t.platformNameHint} error={errorText(errors.platformName)} onChange={(e) => setC("platformName", e.target.value)} required />
          <TextField label={t.taxRegistration} dir="ltr" value={v.taxRegistration} maxLength={max("taxRegistration", 40)} error={errorText(errors.taxRegistration)} onChange={(e) => setC("taxRegistration", e.target.value)} required />
        </div>
        <LocalizedFields label={t.legalName} path="legalName" value={v.legalName} errors={errors} max={max("legalName", 120)} onChange={(next) => setC("legalName", next)} />
        <LocalizedFields label={t.registration} path="registration" value={v.registration} errors={errors} max={max("registration", 80)} onChange={(next) => setC("registration", next)} />
      </>
    );
  }

  if (group === "footer") {
    const v = value as SettingsValues["footer"];
    const setF = set as <K extends keyof SettingsValues["footer"]>(key: K, next: SettingsValues["footer"][K]) => void;
    return (
      <>
        <LocalizedFields label={t.tagline} path="tagline" value={v.tagline} errors={errors} max={max("tagline", 160)} onChange={(next) => setF("tagline", next)} />
        <LocalizedFields label={t.rights} path="rights" value={v.rights} errors={errors} max={max("rights", 120)} onChange={(next) => setF("rights", next)} />
      </>
    );
  }

  const v = value as SettingsValues["email"];
  const setE = set as <K extends keyof SettingsValues["email"]>(key: K, next: SettingsValues["email"][K]) => void;
  return (
    <>
      <TextField label={t.senderName} value={v.senderName} maxLength={max("senderName", 70)} hint={t.senderNameHint} error={errorText(errors.senderName)} onChange={(e) => setE("senderName", e.target.value)} required />
      <LocalizedFields label={t.signature} path="signature" value={v.signature} errors={errors} max={max("signature", 500)} multiline hint={t.signatureHint} onChange={(next) => setE("signature", next)} />
      <div className="space-y-3">
        <Toggle label={t.showSupportEmail} checked={v.footer.showSupportEmail} onChange={(on) => setE("footer", { ...v.footer, showSupportEmail: on })} />
        <Toggle label={t.showSocialLinks} checked={v.footer.showSocialLinks} onChange={(on) => setE("footer", { ...v.footer, showSocialLinks: on })} />
      </div>
    </>
  );
}

const BOTH: Array<"ar" | "en"> = ["ar", "en"];

function PreviewBlock({ lang, children }: { lang: "ar" | "en"; children: ReactNode }) {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="rounded-[0.875rem] bg-paper-sunken/60 p-3 ring-1 ring-line">
      <p className="mb-2 text-xs font-medium text-ink-soft">{lang === "ar" ? t.arabic : t.english}</p>
      {children}
    </div>
  );
}

/** What the sites (or the emails) will show, in both languages, drawn as plain text like they draw it. */
function GroupPreview<G extends SettingsGroup>({
  group,
  value,
  companyName,
  contactEmail,
  socialLinks,
}: {
  group: G;
  value: SettingsValues[G];
  companyName: string;
  contactEmail: string;
  socialLinks: SocialLinkSetting[];
}) {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  const { locale } = useLocale();
  const words = PLATFORM_SETTINGS_STRINGS;

  if (group === "social") {
    const links: SocialLinkConfig[] = (value as SettingsValues["social"]).links.map((l, i) => ({ ...l, order: i + 1 }));
    const shown = visibleSocialLinks(links);
    return shown.length === 0 ? (
      <p className="text-sm text-ink-soft">{t.noLinksShown}</p>
    ) : (
      <div className="space-y-3">
        <SocialLinks locale={locale} links={links} />
        <ul className="space-y-1 text-xs text-ink-soft" dir="ltr">
          {shown.map((item) => (
            <li key={item.platform} className="truncate">
              {PLATFORM_NAMES[item.platform]}: {item.href}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (group === "contact") {
    const v = value as SettingsValues["contact"];
    return (
      <div className="space-y-3">
        {BOTH.map((lang) => (
          <PreviewBlock key={lang} lang={lang}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-soft">{words[lang].supportEmail}</dt>
              <dd dir="ltr" className="text-primary">{v.supportEmail}</dd>
              <dt className="text-ink-soft">{words[lang].phone}</dt>
              <dd dir="ltr" className="text-primary">{v.phone}</dd>
              <dt className="text-ink-soft">{words[lang].address}</dt>
              <dd className="text-ink">{v.address[lang]}</dd>
              <dt className="text-ink-soft">{words[lang].hours}</dt>
              <dd className="text-ink">{v.hours[lang]}</dd>
            </dl>
          </PreviewBlock>
        ))}
      </div>
    );
  }

  if (group === "company") {
    const v = value as SettingsValues["company"];
    return (
      <div className="space-y-3">
        {BOTH.map((lang) => (
          <PreviewBlock key={lang} lang={lang}>
            <p className="text-sm text-ink-soft">
              {v.legalName[lang]} · {words[lang].registration}: {v.registration[lang]} · {words[lang].taxRegistration}: <span dir="ltr">{v.taxRegistration}</span>
            </p>
          </PreviewBlock>
        ))}
      </div>
    );
  }

  if (group === "footer") {
    const v = value as SettingsValues["footer"];
    const year = new Date().getFullYear();
    return (
      <div className="space-y-3">
        {BOTH.map((lang) => (
          <PreviewBlock key={lang} lang={lang}>
            <p className="text-sm text-ink-soft">{v.tagline[lang]}</p>
            <p className="mt-2 border-t border-line pt-2 text-sm text-ink-soft">
              © {year} {companyName} · {v.rights[lang]}
            </p>
          </PreviewBlock>
        ))}
      </div>
    );
  }

  const v = value as SettingsValues["email"];
  const links = v.footer.showSocialLinks
    ? visibleSocialLinks(socialLinks.map((l, i) => ({ ...l, order: i + 1 }))).filter((item) => item.platform !== "email")
    : [];
  const showEmail = v.footer.showSupportEmail && contactEmail.trim() !== "";
  if (!v.signature.ar.trim() && !v.signature.en.trim() && !showEmail && links.length === 0) {
    return <p className="text-sm text-ink-soft">{t.emailPreviewEmpty}</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">
        {t.senderName}: <span className="font-medium text-ink">{v.senderName}</span>
      </p>
      {BOTH.map((lang) => (
        <PreviewBlock key={lang} lang={lang}>
          {(v.signature[lang] || v.signature[lang === "ar" ? "en" : "ar"]) && (
            <p className="text-sm whitespace-pre-line text-ink">{v.signature[lang] || v.signature[lang === "ar" ? "en" : "ar"]}</p>
          )}
          {(showEmail || links.length > 0) && (
            <p className="mt-2 text-xs text-ink-soft">
              {[...(showEmail ? [words[lang].support] : []), ...links.map((l) => PLATFORM_NAMES[l.platform])].join(" · ")}
            </p>
          )}
        </PreviewBlock>
      ))}
    </div>
  );
}

function HistoryPanel<G extends SettingsGroup>({
  group,
  version,
  canManage,
  onApplied,
}: {
  group: G;
  version: number;
  canManage: boolean;
  onApplied: (result: api.SaveResult<G>) => void;
}) {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  const { data, loading, error, refresh } = useAsync(() => api.getHistory(group), [group, version]);
  const [reverting, setReverting] = useState<HistoryEntry | null>(null);
  const groupName = t[`tab_${group}`];

  async function revert() {
    if (!reverting) return;
    onApplied(await withFieldMessages(api.revertChange(group, reverting.id)));
    setReverting(null);
  }

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-1.5">
          <History className="size-4" aria-hidden /> {t.history}
        </span>
      }
      description={t.historyHint}
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()} empty={data?.entries.length === 0} emptyMessage={t.historyEmpty}>
        <ol className="divide-y divide-line">
          {data?.entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {t[`action_${entry.action}` as const] ?? entry.action} · <span className="font-normal text-ink-soft">{when(entry.at)}</span>
                </p>
                <p className="text-xs text-ink-soft">
                  {entry.actor ? entry.actor.name || entry.actor.email : t.someone}
                  {entry.fields.length > 0 && ` · ${fmt(t.fieldsChanged, { fields: entry.fields.map((f) => fieldLabel(t, f)).join(t.listSeparator) })}`}
                </p>
              </div>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setReverting(entry)}>
                  <RotateCcw /> {t.restore}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </DataState>
      <ConfirmDialog
        open={reverting !== null}
        title={t.confirmRevertTitle}
        description={reverting ? fmt(t.confirmRevertBody, { group: groupName, when: when(reverting.at) }) : undefined}
        confirmLabel={t.restore}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setReverting(null)}
        onConfirm={revert}
      >
        {reverting && reverting.before === null && <p className="text-sm text-ink-soft">{t.confirmRevertDefault}</p>}
      </ConfirmDialog>
    </Panel>
  );
}

function PaymentAccountPanel() {
  const t = useT(PLATFORM_SETTINGS_STRINGS);
  const { can } = useAuth();
  return (
    <Panel title={t.paymentTitle}>
      <p className="text-sm text-ink-soft">{t.paymentBody}</p>
      {can(PAYMENT_METHODS_PAGE) && (
        <Link to="/payment-methods" className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4`}>
          {t.openPaymentMethods}
        </Link>
      )}
    </Panel>
  );
}
