import { useMemo, useRef, useState } from "react";
import { Alert } from "@store-builder/ui";
import {
  ApiError,
  PROTECTION_NUMBER_RULES,
  protectionResolveRules,
  protectionSaveRules,
  type CheckoutOtpSettings,
  type ProtectionRuleKey,
} from "@store-builder/api-client";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { IconContacts, IconGlobe, IconKey, IconOrders, IconRobot, IconShield, type IconComponent } from "@/components/icons";
import { SaveBar } from "@/components/SaveBar";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { CountriesField, RuleChip, RuleRow, SwitchRow } from "./rules/RuleFields";
import {
  EDITOR_ROLES,
  GROUPS,
  NUMBER_BOUNDS,
  isNumberRule,
  parseCountries,
  rangeProblem,
  toDraft,
  toRules,
  type Draft,
  type RuleGroupKey,
} from "./rules/rulesModel";
import { RULES_STRINGS } from "./rules/rulesText";

const GROUP_ICON: Record<RuleGroupKey, IconComponent> = {
  orderRules: IconOrders,
  visitorRules: IconGlobe,
  customerRules: IconContacts,
};

/**
 * Fraud protection → Rules: every checkout rule with its own switch, value
 * and action. Six sections that fold to one row each — the three groups of
 * rules, phone verification, visitors, and what always holds — and each row
 * says what is on inside it, from the form as it stands now (saved or not).
 * A folded section keeps its fields mounted, so an edit is never lost by
 * closing it; ONE save bar saves everything.
 */
export function ProtectionRulesTab() {
  const t = useT(RULES_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, refresh } = useWorkspace();

  const stored = useMemo(
    () => protectionResolveRules(currentWorkspace?.settings?.fraud_rules),
    [currentWorkspace?.settings?.fraud_rules]
  );
  // The last rule set known to be on the server — replaced by the PATCH
  // response on save, so "dirty" is right before the silent refresh lands.
  const [saved, setSaved] = useState<Draft>(() => toDraft(stored));
  const [draft, setDraft] = useState<Draft>(() => toDraft(stored));
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const disabled = !editable || saving;

  const rangeProblems = PROTECTION_NUMBER_RULES.filter((key) => rangeProblem(key, draft));
  const countriesProblem = draft.on.block_outside_country && parseCountries(draft.countries) === null;
  const blockedCountriesProblem = parseCountries(draft.blockedCountries) === null;
  const invalid = rangeProblems.length > 0 || countriesProblem || blockedCountriesProblem;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useReportDirty(editable && dirty);

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function discard() {
    setDraft(saved);
    setShowErrors(false);
    setError(null);
  }

  async function save() {
    if (invalid) {
      setShowErrors(true);
      // The save bar follows the screen, so the field at fault may be far
      // above it — or inside a folded section. Once its message has rendered:
      // unfold the section it sits in, then bring the field into view.
      requestAnimationFrame(() => {
        const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (!field) return;
        field.closest("[data-accordion]")?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
        requestAnimationFrame(() => {
          field.scrollIntoView({ block: "center" });
          field.focus({ preventScroll: true });
        });
      });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = toDraft(await protectionSaveRules(apiClient, workspaceId, toRules(draft)));
      setSaved(next);
      setDraft(next);
      setShowErrors(false);
      toast.success(t.saved);
      void refresh({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Whatever the role key suggested, the server says no — stop offering
        // edits and put the stored rules back.
        setForbidden(true);
        setDraft(saved);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  // ---- What each folded section says about itself, from the form as it stands. ----

  const rulesOn = (rules: ReadonlyArray<ProtectionRuleKey>) => rules.filter((key) => draft.on[key]).length;
  const groupProblem = (group: (typeof GROUPS)[number]) =>
    group.rules.some((key) => isNumberRule(key) && rangeProblems.includes(key)) || (group.title === "visitorRules" && countriesProblem);

  /** The chip at the end of a section's row: «راجع» while a failed save points at it, otherwise what is on. */
  const chip = (problem: boolean, on: boolean, text: string) =>
    showErrors && problem ? <RuleChip tone="alert">{t.chipCheck}</RuleChip> : <RuleChip tone={on ? "on" : "off"}>{text}</RuleChip>;

  const otpSummary = draft.otp.enabled
    ? [t[`otpBy_${draft.otp.channel}`], t[`otpApply_${draft.otp.apply_to}`], fmt(t.otpDigits, { n: draft.otp.code_length })].join(t.summarySep)
    : t.otpOffSummary;

  const hiddenCountries = parseCountries(draft.blockedCountries)?.length ?? 0;
  const visitorsSummary = [
    draft.botProtection ? t.botOnSummary : t.botOffSummary,
    draft.botProtection && draft.botCaptcha ? t.botCaptchaSummary : null,
    hiddenCountries > 0 ? pluralOf(t, "countriesHidden", hiddenCountries) : null,
  ]
    .filter(Boolean)
    .join(t.summarySep);

  const alwaysOn = (draft.strictPhone ? 1 : 0) + (draft.block_blacklisted ? 1 : 0);
  const alwaysSummary =
    [draft.strictPhone ? t.alwaysStrictSummary : null, draft.block_blacklisted ? t.alwaysBlockSummary : null].filter(Boolean).join(t.summarySep) ||
    t.alwaysNone;

  return (
    <div ref={formRef} className="space-y-4">
      {!editable && (
        <Alert>
          <p className="font-medium">{t.readOnlyTitle}</p>
          <p>{forbidden ? t.readOnlyForbidden : t.readOnly}</p>
        </Alert>
      )}

      <AccordionGroup>
        {GROUPS.map((group) => {
          const on = rulesOn(group.rules);
          return (
            <AccordionSection
              key={group.title}
              title={t[group.title]}
              icon={GROUP_ICON[group.title]}
              summary={on > 0 ? pluralOf(t, "rulesOn", on) : t.rulesOff}
              badge={chip(groupProblem(group), on > 0, fmt(t.chipCount, { on, total: group.rules.length }))}
              persistKey={`fraud:rules:${group.title}`}
              keepMounted
            >
              <p className="mb-3 text-[13px] leading-5 text-ink-soft">{t[`${group.title}Hint`]}</p>
              <div className="divide-y divide-line">
                {group.rules.map((key) => (
                  <RuleRow
                    key={key}
                    ruleKey={key}
                    draft={draft}
                    disabled={disabled}
                    t={t}
                    error={
                      showErrors && isNumberRule(key) && rangeProblems.includes(key)
                        ? fmt(t.rangeError, { min: NUMBER_BOUNDS[key].min, max: NUMBER_BOUNDS[key].max })
                        : undefined
                    }
                    onToggle={(next) => patch({ on: { ...draft.on, [key]: next } })}
                    onValue={(value) => patch({ values: { ...draft.values, [key]: value } })}
                    onAction={(action) => patch({ actions: { ...draft.actions, [key]: action } })}
                  >
                    {key === "block_outside_country" && draft.on.block_outside_country && (
                      <CountriesField
                        value={draft.countries}
                        disabled={disabled}
                        label={t.allowedCountries}
                        hint={t.allowedCountriesHint}
                        error={showErrors && countriesProblem ? t.allowedCountriesError : undefined}
                        onChange={(countries) => patch({ countries })}
                      />
                    )}
                  </RuleRow>
                ))}
              </div>
            </AccordionSection>
          );
        })}

        <AccordionSection
          title={t.otpHeading}
          icon={IconKey}
          summary={otpSummary}
          badge={chip(false, draft.otp.enabled, draft.otp.enabled ? t.chipOn : t.chipOff)}
          persistKey="fraud:rules:otp"
          keepMounted
        >
          <div className="space-y-3">
            <SwitchRow
              checked={draft.otp.enabled}
              disabled={disabled}
              onChange={(enabled) => patch({ otp: { ...draft.otp, enabled } })}
              label={t.otpEnabled}
              hint={t.otpEnabledHint}
            />
            {draft.otp.enabled && (
              <div data-slot="rule-detail" className="grid gap-3 rounded-2xl bg-paper-sunken/60 px-3 py-3 sm:grid-cols-3">
                <label className="space-y-1.5 text-sm">
                  <span className="text-ink-soft">{t.otpChannel}</span>
                  <Select
                    value={draft.otp.channel}
                    disabled={disabled}
                    className="h-11"
                    onChange={(e) => patch({ otp: { ...draft.otp, channel: e.target.value as CheckoutOtpSettings["channel"] } })}
                  >
                    <option value="whatsapp">{t.otpChannel_whatsapp}</option>
                    <option value="sms">{t.otpChannel_sms}</option>
                  </Select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="text-ink-soft">{t.otpApply}</span>
                  <Select
                    value={draft.otp.apply_to}
                    disabled={disabled}
                    className="h-11"
                    onChange={(e) => patch({ otp: { ...draft.otp, apply_to: e.target.value as CheckoutOtpSettings["apply_to"] } })}
                  >
                    <option value="all">{t.otpApply_all}</option>
                    <option value="cod_only">{t.otpApply_cod_only}</option>
                    <option value="risky_only">{t.otpApply_risky_only}</option>
                  </Select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="text-ink-soft">{t.otpLength}</span>
                  <Select
                    value={String(draft.otp.code_length)}
                    disabled={disabled}
                    className="h-11"
                    onChange={(e) => patch({ otp: { ...draft.otp, code_length: Number(e.target.value) } })}
                  >
                    {[4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {fmt(t.otpDigits, { n })}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            )}
          </div>
        </AccordionSection>

        <AccordionSection
          title={t.visitorsHeading}
          icon={IconRobot}
          summary={visitorsSummary}
          badge={chip(blockedCountriesProblem, draft.botProtection, draft.botProtection ? t.chipOn : t.chipOff)}
          persistKey="fraud:rules:visitors"
          keepMounted
        >
          <div className="space-y-3">
            <SwitchRow
              checked={draft.botProtection}
              disabled={disabled}
              onChange={(botProtection) => patch({ botProtection })}
              label={t.botProtection}
              hint={t.botProtectionHint}
            />
            {draft.botProtection && (
              <SwitchRow
                checked={draft.botCaptcha}
                disabled={disabled}
                onChange={(botCaptcha) => patch({ botCaptcha })}
                label={t.botCaptcha}
                hint={t.botCaptchaHint}
              />
            )}
            <CountriesField
              value={draft.blockedCountries}
              disabled={disabled}
              label={t.blockedCountries}
              hint={t.blockedCountriesHint}
              error={showErrors && blockedCountriesProblem ? t.allowedCountriesError : undefined}
              onChange={(blockedCountries) => patch({ blockedCountries })}
            />
          </div>
        </AccordionSection>

        <AccordionSection
          title={t.alwaysHeading}
          icon={IconShield}
          summary={alwaysSummary}
          badge={chip(false, alwaysOn > 0, fmt(t.chipCount, { on: alwaysOn, total: 2 }))}
          persistKey="fraud:rules:always"
          keepMounted
        >
          <div className="space-y-2">
            <SwitchRow
              checked={draft.strictPhone}
              disabled={disabled}
              onChange={(strictPhone) => patch({ strictPhone })}
              label={t.strictPhone}
              hint={t.strictPhoneHint}
            />
            <SwitchRow
              checked={draft.block_blacklisted}
              disabled={disabled}
              onChange={(block_blacklisted) => patch({ block_blacklisted })}
              label={t.blockBlacklisted}
              hint={t.blockBlacklistedHint}
            />
          </div>
        </AccordionSection>
      </AccordionGroup>

      {/* A failed save says why in the bar itself, where the merchant just tapped. */}
      {editable && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={save}
          onDiscard={discard}
          saveLabel={t.save}
          savingLabel={t.saving}
          discardLabel={t.reset}
          message={
            error ? (
              <span role="alert" className="text-danger">
                {error}
              </span>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
