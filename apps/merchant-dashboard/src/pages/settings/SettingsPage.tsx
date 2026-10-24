import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Label, cn } from "@store-builder/ui";
import type {
  InviteMemberPayload,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { ColorField } from "@/components/ColorField";
import {
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  normalizeHex,
  readThemeColor,
} from "@/lib/brandColors";
import { SettingsLayout, SettingsPane, type SettingsSectionDef, type SettingsTone } from "@/components/settings";
import type { IconComponent } from "@/components/icons";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { storeHost } from "@/lib/storeAddress";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { WhatsappSection } from "./WhatsappSection";
import { AppearanceSection } from "./AppearanceSection";
import { AccountSettingsSection } from "./AccountSettingsSection";
import { DevelopersSection } from "./DevelopersSection";
import { NotificationPreferencesSection } from "./NotificationPreferencesSection";
import { OrderEmailsSection } from "./OrderEmailsSection";
import { BILLING_ROLES } from "@/pages/subscription/billingText";
import { SUBSCRIPTION_STRINGS } from "@/pages/subscription/subscriptionStrings";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { WhatsAppMessageSection } from "./WhatsAppMessageSection";
import { CatalogSettingsSection } from "./CatalogSettingsSection";
import { OrderBumpSettingsSection } from "./OrderBumpSettingsSection";
import { AccountSection } from "./AccountSection";
import { SecuritySection } from "./SecuritySection";
import { STORE_REPORTS_ENABLED, TWO_FACTOR_ENABLED } from "@/lib/features";
import { SummaryReportsSection } from "./SummaryReportsSection";
import { HolidayModeSection } from "./HolidayModeSection";
import { SETTINGS_SECTIONS, SETTINGS_SECTION_STRINGS, isSettingsSectionShown, type SettingsSectionId } from "./settingsSections";

const STRINGS = {
  en: {
    ...SETTINGS_SECTION_STRINGS.en,
    pageTitle: "Settings",
    searchPlaceholder: "Search settings…",
    storeCardRole: "You are signed in to this store",
  },
  ar: {
    ...SETTINGS_SECTION_STRINGS.ar,
    pageTitle: "الإعدادات",
    searchPlaceholder: "ابحث في الإعدادات…",
    storeCardRole: "أنت داخل على هذا المتجر",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

/**
 * Every section of the page, in the order of the list (settingsSections.ts:
 * the dashboard's search reads the same list). The id is what `?tab=`
 * carries. The sections are the ones this page always had; the list only says
 * where each one is.
 */
const SECTIONS = SETTINGS_SECTIONS;

type SectionId = SettingsSectionId;

const SECTION_IDS: ReadonlySet<string> = new Set(SECTIONS.map((section) => section.id));

function isSectionId(value: string | null): value is SectionId {
  return value !== null && SECTION_IDS.has(value);
}

/** Links written before the page had a list (#whatsapp, #notifications…) still land on the right section. */
const HASH_SECTION: Record<string, SectionId> = {
  whatsapp: "whatsapp",
  notifications: "notifications",
  "summary-reports": "notifications",
  "order-emails": "order-emails",
};

/** A block inside a section that a link may point at: brought into view once the section is drawn. */
const SCROLL_ANCHORS: ReadonlySet<string> = new Set(["summary-reports"]);

/** Tailwind's `lg`, where SettingsLayout puts the list and the pane side by side. */
const DESKTOP = "(min-width: 64rem)";

/**
 * The section in the URL, and the way to change it.
 *
 * `?tab=<section id>`; an old `#anchor` is read as the section it means and
 * the URL is rewritten to say so. `null` = none chosen: a phone shows the
 * list, a desktop the first section.
 *
 * On a phone, going from the list into a section adds a history entry, so the
 * browser's Back returns to the list; the back row of the pane goes back to
 * that same entry. Everywhere else the URL is replaced — switching sections
 * does not pile up history.
 */
function useSettingsUrl(): { current: SectionId | null; select: (id: string | null) => void } {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const raw = params.get("tab");
  const hash = location.hash.replace("#", "");
  const current: SectionId | null = isSectionId(raw) ? raw : (HASH_SECTION[hash] ?? null);

  // The block a link pointed at inside its section, kept past the rewrite of the URL below.
  const anchor = useRef<string | null>(null);

  // An old link: say the section in the URL the way the page writes it now (the other params stay).
  useEffect(() => {
    if (current === null || raw === current) return;
    if (SCROLL_ANCHORS.has(hash)) anchor.current = hash;
    const next = new URLSearchParams(location.search);
    next.set("tab", current);
    navigate({ search: `?${next.toString()}`, hash: "" }, { replace: true, state: location.state });
  }, [current, raw, hash, location.search, location.state, navigate]);

  useEffect(() => {
    if (anchor.current === null && SCROLL_ANCHORS.has(hash)) anchor.current = hash;
    const id = anchor.current;
    if (!id) return;
    // Once the section is drawn (the layout scrolls to the top on a switch first).
    const timer = window.setTimeout(() => {
      anchor.current = null;
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [current, hash]);

  const fromList = (location.state as { settingsFromList?: boolean } | null)?.settingsFromList === true;

  const select = useCallback(
    (id: string | null) => {
      const phone = !window.matchMedia(DESKTOP).matches;
      const next = new URLSearchParams(window.location.search);
      if (id === null) {
        // Back to the list: the entry it was opened from, when there is one.
        if (phone && fromList) {
          navigate(-1);
          return;
        }
        next.delete("tab");
        const search = next.toString();
        navigate({ search: search ? `?${search}` : "", hash: "" }, { replace: true });
        return;
      }
      next.set("tab", id);
      const push = phone && current === null;
      navigate(
        { search: `?${next.toString()}`, hash: "" },
        push ? { state: { settingsFromList: true } } : { replace: true, state: fromList ? { settingsFromList: true } : null }
      );
    },
    [current, fromList, navigate]
  );

  return { current, select };
}

export function SettingsPage() {
  const [params] = useSearchParams();
  // Fawaterak's return links (?payment=…&workspace=…&result=…) were made
  // for this page; the payment is now shown in Subscription, with the same query.
  if (params.get("payment")) return <Navigate to={`/subscription?${params.toString()}`} replace />;

  return (
    <UnsavedGuardProvider>
      <SettingsScreen />
    </UnsavedGuardProvider>
  );
}

function SettingsScreen() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const { confirmLeave } = useUnsavedGuard();
  const { current, select } = useSettingsUrl();

  const role = currentWorkspace?.role;
  // A section whose switch is off, or that this role has nothing in, is not listed (and not drawn).
  const hidden = useMemo(
    () => new Set<SectionId>(SECTIONS.filter((section) => !isSettingsSectionShown(section, role)).map((section) => section.id)),
    [role]
  );

  const sections = useMemo<SettingsSectionDef[]>(
    () =>
      SECTIONS.filter((section) => !hidden.has(section.id)).map((section) => ({
        id: section.id,
        label: t[`s_${section.key}`],
        // Security is always listed; two-step sign-in is its part behind a switch.
        description: section.id === "security" && !TWO_FACTOR_ENABLED ? t.d_security_basic : t[`d_${section.key}`],
        icon: section.icon,
        tone: section.tone,
        group: t[`g_${section.group}`],
        keywords: [...section.words],
      })),
    [hidden, t]
  );

  // A desktop with nothing chosen shows the first section (the layout asks for it in the URL too).
  // A link to a section that is not listed for this build or this role lands on the first one as well.
  const shownId: SectionId = current !== null && !hidden.has(current) ? current : "identity";
  const shown = SECTIONS.find((section) => section.id === shownId) ?? SECTIONS[0];

  return (
    <SettingsLayout
      title={t.pageTitle}
      sections={sections}
      current={current !== null && hidden.has(current) ? "identity" : current}
      onSelect={select}
      canLeave={confirmLeave}
      searchPlaceholder={t.searchPlaceholder}
      listHeader={<StoreCard t={t} />}
    >
      {/* A store switch, like a section switch, starts the section afresh. */}
      <SectionFrame key={`${shownId}-${workspaceId}`} id={shownId} title={t[`s_${shown.key}`]} description={t[`d_${shown.key}`]} icon={shown.icon} tone={shown.tone} />
    </SettingsLayout>
  );
}

/** Which store these settings belong to: its logo, its name, its address. Over the list. */
function StoreCard({ t }: { t: T }) {
  const { currentWorkspace } = useWorkspace();
  if (!currentWorkspace) return null;
  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] bg-card px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-line lg:rounded-2xl lg:bg-paper-sunken lg:px-3 lg:py-2.5 lg:shadow-none">
      {currentWorkspace.logoUrl ? (
        <img src={currentWorkspace.logoUrl} alt="" className="size-11 shrink-0 rounded-xl bg-paper object-contain ring-1 ring-line lg:size-9" />
      ) : (
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg font-semibold text-primary lg:size-9 lg:text-base">
          {(currentWorkspace.name || "?").charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-5 font-semibold text-ink lg:text-sm">
          <span className="sr-only">{t.storeCardRole}: </span>
          <bdi>{currentWorkspace.name}</bdi>
        </p>
        {currentWorkspace.slug && (
          <p className="truncate text-[13px] leading-5 text-ink-soft lg:text-xs">
            <bdi dir="ltr">{storeHost(currentWorkspace.slug)}</bdi>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * One section in the pane, under the header the list names it by (its icon
 * tile, its name, one line). Security draws that header itself.
 */
function SectionFrame({ id, title, description, icon, tone }: { id: SectionId; title: string; description: string; icon: IconComponent; tone: SettingsTone }) {
  if (id === "security") return <SecuritySection />;
  return (
    <SettingsPane title={title} description={description} icon={icon} tone={tone}>
      <SectionBody id={id} />
    </SettingsPane>
  );
}

/** The content of one section. Each loads and saves itself. */
function SectionBody({ id }: { id: Exclude<SectionId, "security"> }): ReactNode {
  switch (id) {
    case "identity":
      return <WorkspaceProfileSection />;
    case "account-settings":
      return <AccountSettingsSection />;
    case "catalog":
      return <CatalogSettingsSection />;
    case "order-bump":
      return <OrderBumpSettingsSection />;
    // Pausing orders, or taking them and shipping later (lib/features).
    case "holiday":
      return <HolidayModeSection />;
    case "whatsapp-message":
      return <WhatsAppMessageSection />;
    // The WhatsApp Cloud API connection behind the inbox and automations.
    case "whatsapp":
      return <WhatsappSection />;
    // The emails customers get about their orders.
    case "order-emails":
      return <OrderEmailsSection />;
    case "members":
      return <TeamSection />;
    // The plan itself is in My Plan; this is the way there.
    case "billing":
      return <SubscriptionLinkSection />;
    case "profile":
      return <AccountSection />;
    case "appearance":
      return <AppearanceSection />;
    case "notifications":
      return (
        <>
          <NotificationPreferencesSection />
          {/* A daily or weekly email of the store's numbers to chosen team members (lib/features). */}
          {STORE_REPORTS_ENABLED && <SummaryReportsSection />}
        </>
      );
    case "developers":
      return <DevelopersSection />;
  }
}

/** The plan, payments and referral code moved to the Subscription section. */
function SubscriptionLinkSection() {
  const t = useT(SUBSCRIPTION_STRINGS);
  const { currentWorkspace } = useWorkspace();
  if (!BILLING_ROLES.has(currentWorkspace?.role ?? "")) return null;
  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.settingsTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.settingsBody}</p>
      <Button asChild variant="outline" className="mt-4 min-h-11">
        <Link to="/subscription">{t.settingsOpen}</Link>
      </Button>
    </section>
  );
}

// ---------------------------------------------------------------------
// Workspace profile
// ---------------------------------------------------------------------

/** The note under the store logo: it is the storefront's browser tab icon too. */
const LOGO_STRINGS = {
  en: { tabIcon: "Your logo is also your store's browser tab icon. Use a square image of at least 192×192." },
  ar: { tabIcon: "شعارك هو أيضًا أيقونة متجرك في تبويب المتصفح. استخدم صورة مربعة لا تقل عن 192×192." },
} satisfies Messages;

function WorkspaceProfileSection() {
  const logoText = useT(LOGO_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const saveThemeSettings = useSaveThemeSettings();
  const toast = useToast();

  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [tagline, setTagline] = useState(currentWorkspace?.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(currentWorkspace?.logoUrl ?? null);
  const [logoStage, setLogoStage] = useState<"preparing" | "uploading" | null>(null);
  const uploading = logoStage !== null;
  // What the colour fields opened with: a colour is only written once the
  // merchant changes it here, so saving the name or logo never pins the
  // platform default over a store theme's own accent.
  const [initialColors] = useState(() => ({
    primary: readThemeColor(currentWorkspace?.themeSettings, "primaryColor", DEFAULT_PRIMARY),
    secondary: readThemeColor(currentWorkspace?.themeSettings, "secondaryColor", DEFAULT_SECONDARY),
  }));
  const [primaryColor, setPrimaryColor] = useState(initialColors.primary);
  const [secondaryColor, setSecondaryColor] = useState(initialColors.secondary);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const colorsValid = Boolean(normalizeHex(primaryColor) && normalizeHex(secondaryColor));

  async function onLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a failure
    if (!file) return;
    setFormError(null);
    try {
      // Resize first if it is over the 5 MB cap, so a big logo export uploads
      // instead of being rejected.
      setLogoStage("preparing");
      const prepared = await compressImageIfNeeded(file);
      const problem = validateImageFile(prepared);
      if (problem) {
        setFormError(problem);
        return;
      }
      setLogoStage("uploading");
      const media = await apiClient.uploadMedia(workspaceId, prepared);
      setLogoUrl(media.url);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLogoStage(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const primary = normalizeHex(primaryColor) ?? DEFAULT_PRIMARY;
      const secondary = normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY;
      await saveThemeSettings((current) => {
        // Merge, never replace: themeSettings is a shared blob and may already
        // carry keys owned by other parts of the product.
        const themeSettings: Record<string, unknown> = { ...current };
        if (primary !== initialColors.primary) {
          themeSettings.primaryColor = primary;
          // The merchant's own colour now, no longer one a template carried over.
          delete themeSettings.primaryColorSource;
        }
        if (secondary !== initialColors.secondary) themeSettings.secondaryColor = secondary;
        return { name: name.trim(), tagline: tagline.trim() || null, logoUrl, themeSettings };
      });
      toast.success("Store profile saved.");
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">Store profile</h2>
      <p className="mt-1 text-sm text-ink-soft">
        The name, logo, and tagline shown across your dashboard and storefront.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />

        <div className="space-y-1.5">
          <Label>Logo</Label>
          <div className="flex flex-wrap items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Store logo"
                className="size-16 rounded-[0.5rem] border border-line bg-paper object-contain"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-[0.5rem] border border-dashed border-line text-xs text-ink-soft">
                None
              </div>
            )}
            <label
              className={cn(
                "inline-flex cursor-pointer items-center rounded-[0.5rem] border border-line bg-paper-raised px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper",
                uploading && "pointer-events-none opacity-50"
              )}
            >
              {logoStage === "preparing" ? "Resizing…" : logoStage === "uploading" ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept={ACCEPTED_IMAGE_ACCEPT}
                className="hidden"
                disabled={uploading}
                onChange={onLogoFile}
              />
            </label>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-soft">PNG, JPEG, GIF or WEBP, up to 5MB.</p>
          <p className="text-xs text-ink-soft">{logoText.tabIcon}</p>
        </div>

        <TextField
          label="Tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          error={fieldErrors.tagline}
          hint="Optional — a short line shown under your store name."
        />

        <div className="space-y-4 rounded-[0.5rem] border border-line p-4">
          <div>
            <h3 className="text-sm font-medium text-ink">Store colours</h3>
            <p className="mt-0.5 text-xs text-ink-soft">
              Used for your storefront header, buttons and links.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField
              label="Primary"
              hint="Buttons, links and highlights."
              value={primaryColor}
              onChange={setPrimaryColor}
            />
            <ColorField
              label="Secondary"
              hint="Accents and badges."
              value={secondaryColor}
              onChange={setSecondaryColor}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Preview</Label>
            <div
              className="flex flex-wrap items-center gap-3 rounded-[0.5rem] border border-line p-3"
              style={{ backgroundColor: `${normalizeHex(primaryColor) ?? DEFAULT_PRIMARY}14` }}
            >
              <span
                className="rounded-[0.5rem] px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: normalizeHex(primaryColor) ?? DEFAULT_PRIMARY }}
              >
                Add to cart
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY }}
              >
                Sale
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: normalizeHex(primaryColor) ?? DEFAULT_PRIMARY }}
              >
                View details
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || uploading || !name.trim() || !colorsValid}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------

function TeamSection() {
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const toast = useToast();

  const data = useAsync(
    () =>
      Promise.all([
        apiClient.listWorkspaceMembers(workspaceId),
        apiClient.listPendingInvites(workspaceId),
        apiClient.listWorkspaceRoles(workspaceId),
      ]).then(([members, invites, roles]) => ({ members, invites, roles })),
    [workspaceId]
  );

  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);

  const reload = () => data.refresh({ silent: true });
  const members = data.data?.members ?? [];
  const invites = data.data?.invites ?? [];
  const roles = data.data?.roles ?? [];

  async function changeRole(member: WorkspaceMember, roleId: string) {
    try {
      await apiClient.updateMemberRole(workspaceId, member.id, roleId);
      toast.success("Role updated.");
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function resend(invite: WorkspaceInvite) {
    try {
      await apiClient.resendInvite(workspaceId, invite.id);
      toast.success(`Invite re-sent to ${invite.invitedEmail}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    await apiClient.removeMember(workspaceId, removing.id);
    toast.success("Member removed.");
    setRemoving(null);
    reload();
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">Team members</h2>
          <p className="mt-1 text-sm text-ink-soft">
            People who can sign in to this store, and the role that sets what they can do.
          </p>
        </div>
        <Button onClick={() => setInviting(true)} disabled={roles.length === 0}>
          Invite member
        </Button>
      </div>

      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        <div className="mt-4 space-y-8">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = Boolean(member.user && user && member.user.id === user.id);
                  return (
                    <tr key={member.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {member.user?.fullName || member.user?.email || "—"}
                          {isSelf && (
                            <span className="ms-1.5 text-xs font-normal text-ink-soft">(you)</span>
                          )}
                        </div>
                        {member.user?.email && (
                          <div className="text-xs text-ink-soft">{member.user.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-ink-soft">{member.role.name}</span>
                        ) : (
                          <Select
                            aria-label={`Role for ${member.user?.email ?? "member"}`}
                            value={member.role.id}
                            onChange={(e) => changeRole(member, e.target.value)}
                            className="max-w-[220px]"
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {isSelf ? (
                          <span
                            className="text-xs text-ink-soft"
                            title="You can't remove yourself"
                          >
                            —
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger-soft"
                            onClick={() => setRemoving(member)}
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {invites.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Pending invites</h3>
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-ink">{invite.invitedEmail}</span>
                            <StatusBadge value="invited" tone="warning" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{invite.role.name}</td>
                        <td className="px-4 py-3 text-end">
                          <Button size="sm" variant="ghost" onClick={() => resend(invite)}>
                            Resend
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DataState>

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite member"
        description="They'll get an email with a link to join this store."
      >
        <InviteMemberForm
          roles={roles}
          onCancel={() => setInviting(false)}
          onDone={() => {
            setInviting(false);
            reload();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={
          removing?.user
            ? `Remove ${removing.user.fullName || removing.user.email}?`
            : "Remove this member?"
        }
        description="They lose access to this store immediately. You can invite them again later."
        confirmLabel="Remove member"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}

function InviteMemberForm({
  roles,
  onCancel,
  onDone,
}: {
  roles: WorkspaceRole[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  // Translated by code: an account that hasn't confirmed its email yet can't
  // be invited (INVITEE_NOT_CONFIRMED), which the inviter must understand.
  const describeError = useErrorMessage();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const payload: InviteMemberPayload = { email: email.trim(), roleId };
      await apiClient.inviteMember(workspaceId, payload);
      toast.success(`Invite sent to ${payload.email}.`);
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        placeholder="teammate@example.com"
      />

      <Field label="Role" required error={fieldErrors.roleId}>
        {({ id }) => (
          <Select id={id} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !email.trim() || !roleId}>
          {saving ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
