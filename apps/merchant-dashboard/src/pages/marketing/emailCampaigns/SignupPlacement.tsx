import { useState } from "react";
import { Alert, Input } from "@store-builder/ui";
import {
  EMAIL_SIGNUP_POPUP_DELAY,
  EMAIL_SIGNUP_SOURCES,
  emailSignupGet,
  emailSignupSave,
  type EmailSignupBoxPlace,
  type EmailSignupCopy,
  type EmailSignupSettings,
  type EmailSignupStats,
  type EmailSignupView,
} from "@store-builder/api-client";
import { CardSkeleton, DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Segmented } from "@/components/Segmented";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useAsync } from "@/lib/useAsync";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT } from "@/i18n/LocaleContext";
import { FormProblem } from "../../offers/OfferKit";
import { SignupPreview } from "./SignupPreview";
import { SIGNUP_STRINGS, type SignupText } from "./signupStrings";

const BOXES: EmailSignupBoxPlace[] = ["checkout", "quickOrder", "cart"];
const COPY_FIELDS: Array<{ key: keyof EmailSignupCopy; max: number }> = [
  { key: "label", max: 160 },
  { key: "privacy", max: 240 },
  { key: "incentive", max: 120 },
];

/** The form keeps the seconds as typed; the settings take a whole number. */
type Draft = Omit<EmailSignupSettings, "popup"> & { popup: Omit<EmailSignupSettings["popup"], "delaySeconds"> & { delaySeconds: string } };

const draftOf = (s: EmailSignupSettings): Draft => ({ ...s, popup: { ...s.popup, delaySeconds: String(s.popup.delaySeconds) } });

function delayOf(draft: Draft): number | null {
  const text = draft.popup.delaySeconds.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= EMAIL_SIGNUP_POPUP_DELAY.min && n <= EMAIL_SIGNUP_POPUP_DELAY.max ? n : null;
}

/** The settings to send: empty words become null (the storefront's default). */
function payloadOf(draft: Draft, delay: number): EmailSignupSettings {
  const clean = (c: EmailSignupCopy): EmailSignupCopy => ({
    label: c.label?.trim() || null,
    privacy: c.privacy?.trim() || null,
    incentive: c.incentive?.trim() || null,
  });
  return { ...draft, popup: { ...draft.popup, delaySeconds: delay }, text: { ar: clean(draft.text.ar), en: clean(draft.text.en) } };
}

/**
 * Marketing → Email campaigns → Signup placement (`?tab=signup`): where
 * shoppers can sign up for the store's marketing emails, the box text, the
 * popup's trigger, how many can receive campaigns and where they signed up,
 * and a live preview of each place. Same flag, permission and plan gate as
 * the campaigns (the page shows the plan notice instead of this when locked).
 */
export function SignupPlacement() {
  const t = useT(SIGNUP_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const [view, setView] = useState<EmailSignupView | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loaded = useAsync(async () => {
    const next = await emailSignupGet(apiClient, workspaceId);
    setView(next);
    setDraft(draftOf(next.settings));
    setSaved(draftOf(next.settings));
    return next;
  }, [workspaceId]);

  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
  useReportDirty(dirty);
  const delay = draft ? delayOf(draft) : null;
  const delayError = draft && draft.popup.enabled && delay === null ? t.delayError : undefined;

  const update = (change: (d: Draft) => Draft) => {
    setError(null);
    setDraft((d) => (d ? change(d) : d));
  };

  async function save() {
    if (!draft) return;
    const seconds = delay ?? (draft.popup.enabled ? null : Number(saved?.popup.delaySeconds) || 15);
    if (seconds === null) {
      setError(t.delayError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await emailSignupSave(apiClient, workspaceId, payloadOf(draft, seconds));
      setView(next);
      setDraft(draftOf(next.settings));
      setSaved(draftOf(next.settings));
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const skeleton = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" aria-hidden>
      <div className="space-y-4">
        <CardSkeleton lines={2} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
      <CardSkeleton lines={5} />
    </div>
  );

  return (
    <section aria-labelledby="signup-placement-title" className="min-w-0">
      <div className="mb-4">
        <h2 id="signup-placement-title" className="text-base font-semibold text-ink">
          {t.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      </div>
      <DataState loading={loaded.loading && !draft} error={loaded.error} onRetry={() => loaded.refresh()} skeleton={skeleton}>
        {draft && view && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
            <div className="min-w-0 space-y-4">
              <SubscriberStats stats={view.stats} t={t} />
              {view.checkoutEmailField === "hidden" && <Alert variant="info">{t.emailHidden}</Alert>}

              <SettingsGroup title={t.boxesGroup} description={t.boxesHint}>
                {BOXES.map((place) => (
                  <div key={place} data-place={place}>
                    <SettingsSwitch
                      checked={draft[place].enabled}
                      onChange={(enabled) => update((d) => ({ ...d, [place]: { ...d[place], enabled } }))}
                      label={t[`place_${place}` as keyof SignupText]}
                      hint={t[`place_${place}Hint` as keyof SignupText]}
                      disabled={busy}
                    />
                    {draft[place].enabled && (
                      <SettingsSwitch
                        checked={draft[place].preTicked}
                        onChange={(preTicked) => update((d) => ({ ...d, [place]: { ...d[place], preTicked } }))}
                        label={t.preTicked}
                        hint={t.preTickedHint}
                        disabled={busy}
                        className="ps-10"
                      />
                    )}
                  </div>
                ))}
              </SettingsGroup>

              <SettingsGroup title={t.formsGroup} description={t.formsHint}>
                <SettingsSwitch
                  checked={draft.footer.enabled}
                  onChange={(enabled) => update((d) => ({ ...d, footer: { enabled } }))}
                  label={t.place_footer}
                  hint={t.place_footerHint}
                  disabled={busy}
                />
                <SettingsSwitch
                  checked={draft.popup.enabled}
                  onChange={(enabled) => update((d) => ({ ...d, popup: { ...d.popup, enabled } }))}
                  label={t.place_popup}
                  hint={t.place_popupHint}
                  disabled={busy}
                />
                {draft.popup.enabled && (
                  <div className="space-y-4 px-4 py-4">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-ink">{t.trigger}</p>
                      <Segmented
                        label={t.trigger}
                        value={draft.popup.trigger}
                        onChange={(trigger) => update((d) => ({ ...d, popup: { ...d.popup, trigger } }))}
                        options={[
                          { value: "delay", label: t.trigger_delay },
                          { value: "exit_intent", label: t.trigger_exit_intent },
                        ]}
                      />
                    </div>
                    <Field label={t.delaySeconds} hint={t.delayHint} error={delayError}>
                      {(aria) => (
                        <Input
                          {...aria}
                          type="number"
                          inputMode="numeric"
                          min={EMAIL_SIGNUP_POPUP_DELAY.min}
                          max={EMAIL_SIGNUP_POPUP_DELAY.max}
                          step={1}
                          dir="ltr"
                          value={draft.popup.delaySeconds}
                          disabled={busy}
                          onChange={(e) => update((d) => ({ ...d, popup: { ...d.popup, delaySeconds: e.target.value } }))}
                          className="min-h-11 w-28"
                        />
                      )}
                    </Field>
                  </div>
                )}
              </SettingsGroup>

              <SettingsGroup title={t.textGroup} description={t.textHint}>
                <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
                  {(["ar", "en"] as const).map((lang) => {
                    const defaults = SIGNUP_STRINGS[lang];
                    const placeholder = {
                      label: fmt(defaults.sfBoxLabel, { store: currentWorkspace?.name ?? "" }),
                      privacy: defaults.sfBoxHint,
                      incentive: defaults.incentivePlaceholder,
                    };
                    return (
                      <fieldset key={lang} className="min-w-0 space-y-3">
                        <legend className="mb-1 text-sm font-semibold text-ink">{lang === "ar" ? t.arabic : t.english}</legend>
                        {COPY_FIELDS.map(({ key, max }) => (
                          <Field key={key} label={t[key]} hint={key === "incentive" ? t.incentiveHint : undefined}>
                            {(aria) => (
                              <Input
                                {...aria}
                                dir={lang === "ar" ? "rtl" : "ltr"}
                                lang={lang}
                                maxLength={max}
                                value={draft.text[lang][key] ?? ""}
                                placeholder={placeholder[key]}
                                disabled={busy}
                                onChange={(e) => update((d) => ({ ...d, text: { ...d.text, [lang]: { ...d.text[lang], [key]: e.target.value } } }))}
                                className="min-h-11"
                              />
                            )}
                          </Field>
                        ))}
                      </fieldset>
                    );
                  })}
                </div>
              </SettingsGroup>

              <FormProblem>{error}</FormProblem>
              <SaveBar
                dirty={dirty}
                saving={busy}
                onSave={() => void save()}
                onDiscard={() => {
                  setDraft(saved);
                  setError(null);
                }}
              />
            </div>

            <div className="min-w-0 lg:sticky lg:top-4">
              <SignupPreview draft={{ ...draft, popup: { ...draft.popup, delaySeconds: delay ?? 15 } }} storeName={currentWorkspace?.name ?? ""} />
            </div>

          </div>
        )}
      </DataState>
    </section>
  );
}

/** How many campaigns reach now, and where they signed up, as a labelled list of bars. */
function SubscriberStats({ stats, t }: { stats: EmailSignupStats; t: SignupText }) {
  const rows = [...EMAIL_SIGNUP_SOURCES, "other" as const].map((source) => ({ source, n: stats.bySource[source] ?? 0 }));
  const top = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section aria-labelledby="signup-stats-title" className="rounded-xl border border-line bg-paper-raised p-4 shadow-[var(--shadow-card)]">
      <h3 id="signup-stats-title" className="text-sm font-semibold text-ink">
        {t.statsTitle}
      </h3>
      {stats.subscribers === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{t.statsEmpty}</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">{formatCount(stats.subscribers)}</p>
          <p className="text-xs text-ink-soft">{fmt(t.statsCount, { count: formatCount(stats.subscribers) })}</p>
          <h4 className="mt-4 text-xs font-medium text-ink-soft">{t.bySource}</h4>
          <ul className="mt-2 space-y-2">
            {rows.map(({ source, n }) => (
              <li key={source} data-source={source} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <span className="truncate text-ink">{t[`source_${source}` as keyof SignupText]}</span>
                <span className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((n / top) * 100)}%` }} />
                </span>
                <span className="text-end font-medium text-ink tabular-nums">{formatCount(n)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
