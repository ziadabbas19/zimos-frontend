import { useId, type ReactNode } from "react";
import { Input, cn } from "@store-builder/ui";
import { PROTECTION_ACTIONS, type ProtectionAction, type ProtectionRuleKey } from "@store-builder/api-client";
import { Select } from "@/components/Select";
import { NUMBER_BOUNDS, isNumberRule, type Draft } from "./rulesModel";
import type { RulesStrings } from "./rulesText";

// The Mac switch: a 48x28 track and a thumb that slides along the reading direction (translate only, on the
// house spring). A checkbox underneath, so the keyboard and screen readers get the real control. On its own
// the track is grey and turns the brand colour (the thumb then takes the ink that reads on it, light or dark);
// glass/returns-protection.css gives it the brand gradient.
const SWITCH =
  "zimos-switch relative mt-0.5 h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong/60 " +
  "transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] checked:bg-primary " +
  "disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none " +
  "before:absolute before:start-0.5 before:top-0.5 before:size-6 before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgb(0_0_0/0.3)] before:content-[''] " +
  "before:transition-[translate] before:duration-[var(--dur-move)] before:ease-[var(--ease-spring)] motion-reduce:before:transition-none " +
  "checked:before:translate-x-5 checked:before:bg-primary-foreground rtl:checked:before:-translate-x-5 forced-colors:checked:bg-[color:Highlight]";

/** A switch with its label and hint. The whole row is the target, at least 44px tall. */
export function SwitchRow({
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  const hintId = useId();
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 has-[:disabled]:cursor-default">
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-6 font-medium text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="block text-[13px] leading-5 text-ink-soft">
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? hintId : undefined}
        className={SWITCH}
      />
    </label>
  );
}

/** What a folded section says in a glance: how many of its rules are on, or that something in it needs a look. */
export function RuleChip({ tone, children }: { tone: "on" | "off" | "alert"; children: ReactNode }) {
  return (
    <span
      data-slot="rule-chip"
      data-tone={tone}
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs leading-none font-semibold whitespace-nowrap tabular-nums",
        tone === "on" ? "bg-success-soft text-success" : tone === "alert" ? "bg-danger-soft text-danger" : "bg-paper-sunken text-ink-soft"
      )}
    >
      {children}
    </span>
  );
}

/** One rule: its switch, and — while it is on — its number (number rules only) and what it does when it fires. */
export function RuleRow({
  ruleKey,
  draft,
  disabled,
  error,
  t,
  onToggle,
  onValue,
  onAction,
  children,
}: {
  ruleKey: ProtectionRuleKey;
  draft: Draft;
  disabled: boolean;
  error?: string;
  t: RulesStrings;
  onToggle: (on: boolean) => void;
  onValue: (value: string) => void;
  onAction: (action: ProtectionAction) => void;
  children?: ReactNode;
}) {
  const inputId = useId();
  const actionId = useId();
  const errorId = useId();
  const numeric = isNumberRule(ruleKey);
  const on = draft.on[ruleKey];
  return (
    <div data-slot="rule-row" className="space-y-2.5 py-3 first:pt-0 last:pb-0">
      <SwitchRow checked={on} disabled={disabled} onChange={onToggle} label={t[ruleKey]} hint={t[`${ruleKey}Hint` as keyof RulesStrings]} />
      {on && (
        <div data-slot="rule-detail" className="space-y-3 rounded-2xl bg-paper-sunken/60 px-3 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {numeric && (
              <div className="flex items-center gap-2">
                <label htmlFor={inputId} className="sr-only">
                  {`${t[ruleKey]} (${t[`${ruleKey}Unit` as keyof RulesStrings]})`}
                </label>
                <Input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={NUMBER_BOUNDS[ruleKey].min}
                  max={NUMBER_BOUNDS[ruleKey].max}
                  step={1}
                  value={draft.values[ruleKey]}
                  disabled={disabled}
                  onChange={(e) => onValue(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className={cn("h-11 w-28 tabular-nums", error && "border-danger")}
                />
                <span className="text-sm text-ink-soft">{t[`${ruleKey}Unit` as keyof RulesStrings]}</span>
              </div>
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label htmlFor={actionId} className="text-sm text-ink-soft">
                {t.then}
              </label>
              <Select
                id={actionId}
                value={draft.actions[ruleKey]}
                disabled={disabled}
                onChange={(e) => onAction(e.target.value as ProtectionAction)}
                className="h-11 w-auto max-w-full min-w-52"
              >
                {PROTECTION_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {t[`action_${action}`]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {error && (
            <p id={errorId} className="text-xs font-medium text-danger">
              {error}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/** A list of two-letter country codes, typed. */
export function CountriesField({
  value,
  disabled,
  label,
  hint,
  error,
  onChange,
}: {
  value: string;
  disabled: boolean;
  label: string;
  hint: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <Input
        id={id}
        dir="ltr"
        value={value}
        disabled={disabled}
        placeholder="EG, SA"
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hintId}
        className={cn("h-11 max-w-sm", error && "border-danger")}
      />
      <p id={hintId} className={cn("text-xs leading-5", error ? "font-medium text-danger" : "text-ink-soft")}>
        {error ?? hint}
      </p>
    </div>
  );
}
