import { useId, useState } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import { CART_REWARD_ICONS, CART_REWARDS_INHERITED_LOOK, type CartRewardIcon } from "@store-builder/api-client";
import { HEX, RewardIcon, autoFixLook, defaultRewardIcon, type ContrastProblem } from "@store-builder/ui/cart-rewards";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Segmented } from "@/components/Segmented";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { APPEARANCE_STRINGS, appearanceProblems, type Appearance, type Look } from "./barAppearanceLook";

/**
 * Offers → Cart rewards → Bar appearance: the store's style (the default; the
 * bar takes the theme's colours, corners, fonts and light or dark mode, and
 * follows a later theme change on its own) or the merchant's own look. Its
 * controls only work while customising; while the store's style is chosen
 * they show, greyed, the values the theme gives. Switching to "Customize"
 * starts from those (nothing jumps) or from the custom values saved before;
 * switching back keeps the custom values saved, unused. "Reset to default"
 * goes back to the store's style and clears them, after asking.
 *
 * Custom colours must reach 3:1 against each other (WCAG non-text contrast):
 * a failing pair is named, with an auto-fix, and the page will not save it.
 * The server checks the same (backend cartRewards/barAppearance.js).
 */


export function BarAppearanceSection({ appearance, onChange, disabled }: { appearance: Appearance; onChange: (next: Appearance) => void; disabled: boolean }) {
  const t = useT(APPEARANCE_STRINGS);
  const [confirming, setConfirming] = useState(false);
  const custom = appearance.mode === "custom";
  // While the store's style is used, the controls show what the theme gives.
  const look: Look = custom && appearance.custom ? appearance.custom : CART_REWARDS_INHERITED_LOOK;
  const locked = disabled || !custom;
  const set = (change: Partial<Look>) => onChange({ mode: "custom", custom: { ...look, ...change } });
  const problems = appearanceProblems(appearance);
  const describe = (p: ContrastProblem) => {
    const name = (c: string, own: string | null) => (own ? c.toUpperCase() : `${c.toUpperCase()} ${t.themeColor}`);
    const [a, b] = p.colors;
    return fmt(p.pair === "fill_track" ? t.pair_fill_track : t.pair_icon_fill, {
      a: p.pair === "fill_track" ? name(a, look.fillColor) : a.toUpperCase(),
      b: p.pair === "fill_track" ? name(b, look.trackColor) : b.toUpperCase(),
      ratio: String(p.ratio),
    });
  };

  return (
    <SettingsGroup title={t.title} description={t.description}>
      <div className="space-y-5 px-4 py-4">
        <div className="space-y-2">
          <Segmented
            value={appearance.mode}
            onChange={(mode) => {
              if (disabled) return;
              // To "Customize": the custom values saved before, else what the theme gives now. Back: kept, unused.
              onChange(mode === "custom" ? { mode, custom: appearance.custom ?? { ...CART_REWARDS_INHERITED_LOOK } } : { mode, custom: appearance.custom });
            }}
            label={t.mode}
            options={[
              { value: "inherit", label: t.inherit },
              { value: "custom", label: t.custom },
            ]}
          />
          <p className="text-xs text-ink-soft">{custom ? t.customHint : t.inheritHint}</p>
        </div>

        <fieldset disabled={locked} data-look-controls="" aria-disabled={locked} className={cn("space-y-5", !custom && "opacity-60")}>
          <legend className="sr-only">{t.title}</legend>
          <Choice label={t.shape} value={look.shape} onChange={(shape) => set({ shape })} options={(["thin", "thick", "segmented"] as const).map((v) => ({ value: v, label: t[`shape_${v}`] }))} />
          <Choice label={t.corners} value={look.corners} onChange={(corners) => set({ corners })} options={(["rounded", "square"] as const).map((v) => ({ value: v, label: t[`corners_${v}`] }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <LookColor name={t.fillColor} value={look.fillColor} fallback="#357150" disabled={locked} onChange={(fillColor) => set({ fillColor })} />
            <LookColor name={t.trackColor} value={look.trackColor} fallback="#DCDACE" disabled={locked} onChange={(trackColor) => set({ trackColor })} />
          </div>
          {problems.length > 0 && (
            <div role="alert" className="space-y-2 rounded-[0.5rem] border border-danger/40 bg-danger/5 p-3">
              <p className="text-sm font-semibold text-danger">{t.contrastTitle}</p>
              <ul className="space-y-1.5">
                {problems.map((p) => (
                  <li key={p.pair} className="flex items-center gap-2 text-sm text-ink" data-contrast-pair={p.pair}>
                    <span className="flex shrink-0" aria-hidden="true">
                      <span className="size-5 rounded-s-full border border-line" style={{ backgroundColor: p.colors[0] }} />
                      <span className="size-5 rounded-e-full border border-line" style={{ backgroundColor: p.colors[1] }} />
                    </span>
                    {describe(p)}
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onChange({ mode: "custom", custom: autoFixLook(look) })}>
                {t.autoFix}
              </Button>
            </div>
          )}
          <Choice label={t.marker} value={look.marker} onChange={(marker) => set({ marker })} options={(["circle", "rounded_square", "none"] as const).map((v) => ({ value: v, label: t[`marker_${v}`] }))} />
          <Choice label={t.markerSize} value={look.markerSize} onChange={(markerSize) => set({ markerSize })} options={(["sm", "md", "lg"] as const).map((v) => ({ value: v, label: t[`size_${v}`] }))} />
          <div className="divide-y divide-line rounded-[0.5rem] ring-1 ring-line">
            <SettingsSwitch checked={look.showAmounts} onChange={(showAmounts) => set({ showAmounts })} label={t.showAmounts} disabled={locked} />
            <SettingsSwitch checked={look.reachedPop} onChange={(reachedPop) => set({ reachedPop })} label={t.reachedPop} hint={t.reachedPopHint} disabled={locked} />
            <SettingsSwitch checked={look.showMessage} onChange={(showMessage) => set({ showMessage })} label={t.showMessage} hint={t.showMessageHint} disabled={locked} />
          </div>
          <Choice label={t.messageAlign} value={look.messageAlign} onChange={(messageAlign) => set({ messageAlign })} options={(["start", "center"] as const).map((v) => ({ value: v, label: t[`align_${v}`] }))} />
        </fieldset>

        <Button type="button" variant="outline" className="min-h-11" disabled={disabled || (!custom && !appearance.custom)} onClick={() => setConfirming(true)}>
          {t.reset}
        </Button>
        <ConfirmDialog
          open={confirming}
          title={t.resetTitle}
          description={t.resetBody}
          confirmLabel={t.resetConfirm}
          cancelLabel={t.cancel}
          destructive
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            onChange({ mode: "inherit", custom: null });
            setConfirming(false);
          }}
        />
      </div>
    </SettingsGroup>
  );
}

/** One labelled single choice (the house segmented control: a radio group, keyboard included). */
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink" aria-hidden="true">
        {label}
      </p>
      <Segmented value={value} onChange={(next) => onChange(next)} label={label} options={options} className="max-w-full" />
    </div>
  );
}

/** A colour: the theme's, or the merchant's (a native picker and its hex). */
function LookColor({ name, value, fallback, disabled, onChange }: { name: string; value: string | null; fallback: string; disabled: boolean; onChange: (value: string | null) => void }) {
  const t = useT(APPEARANCE_STRINGS);
  const id = useId();
  const own = value !== null;
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? (value ?? fallback).toUpperCase();
  const valid = HEX.test(shown);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{name}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
          <input type="radio" name={id} checked={!own} disabled={disabled} onChange={() => onChange(null)} className="size-4 accent-primary" />
          {t.colorTheme}
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
          <input type="radio" name={id} checked={own} disabled={disabled} onChange={() => onChange((value ?? fallback).toLowerCase())} className="size-4 accent-primary" />
          {t.colorCustom}
        </label>
      </div>
      {own && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={fmt(t.colorPicker, { name })}
            value={HEX.test(value ?? "") ? (value as string) : fallback.toLowerCase()}
            disabled={disabled}
            onChange={(e) => {
              setTyped(null);
              onChange(e.target.value.toLowerCase());
            }}
            className="size-11 shrink-0 cursor-pointer rounded-[0.5rem] border border-line-strong bg-paper-raised p-1"
          />
          <Input
            aria-label={fmt(t.colorHex, { name })}
            value={shown}
            disabled={disabled}
            dir="ltr"
            spellCheck={false}
            maxLength={7}
            aria-invalid={valid ? undefined : true}
            onChange={(e) => {
              const next = e.target.value.trim();
              setTyped(next);
              if (HEX.test(next)) onChange(next.toLowerCase());
            }}
            onBlur={() => setTyped(null)}
            className={cn("min-h-11 w-32 font-mono uppercase", !valid && "border-danger")}
          />
        </div>
      )}
      {own && !valid && <p className="text-xs text-danger">{t.invalidHex}</p>}
    </fieldset>
  );
}

const ICON_STRINGS = {
  en: {
    icon: "Icon",
    byKind: "By its kind ({name})",
    gift: "Gift",
    truck: "Truck",
    percent: "Percent",
    tag: "Tag",
    star: "Star",
    heart: "Heart",
    crown: "Crown",
    bolt: "Bolt",
    check: "Check",
  },
  ar: {
    icon: "الأيقونة",
    byKind: "حسب نوعها ({name})",
    gift: "هدية",
    truck: "شاحنة",
    percent: "نسبة",
    tag: "بطاقة سعر",
    star: "نجمة",
    heart: "قلب",
    crown: "تاج",
    bolt: "برق",
    check: "علامة صح",
  },
} satisfies Messages;

/**
 * A reward's icon: one of the shared set (drawn inline), or none picked — then
 * its kind's (truck for free shipping, percent for a percentage, tag for an
 * amount). A radio group: arrow keys move, each choice is 44px square.
 */
export function RewardIconPicker({ type, value, onChange, disabled }: { type: string; value: CartRewardIcon | null; onChange: (icon: CartRewardIcon | null) => void; disabled: boolean }) {
  const t = useT(ICON_STRINGS);
  const name = useId();
  const kind = defaultRewardIcon(type);
  const option = (icon: CartRewardIcon | null) => {
    const shown = icon ?? kind;
    const label = icon === null ? fmt(t.byKind, { name: t[kind] }) : t[icon];
    const checked = value === icon;
    return (
      <label
        key={icon ?? "kind"}
        title={label}
        className={cn(
          "relative flex size-11 cursor-pointer items-center justify-center rounded-[0.5rem] border text-ink transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40",
          checked ? "border-primary bg-primary/10 text-primary" : "border-line hover:bg-paper",
          icon === null && "border-dashed",
          disabled && "cursor-default opacity-60"
        )}
      >
        <input type="radio" name={name} className="sr-only" checked={checked} disabled={disabled} onChange={() => onChange(icon)} aria-label={label} />
        <RewardIcon name={shown} size={18} filled={checked} />
      </label>
    );
  };
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-ink">{t.icon}</legend>
      <div className="flex flex-wrap gap-1.5">
        {option(null)}
        {CART_REWARD_ICONS.map((icon) => option(icon))}
      </div>
    </fieldset>
  );
}
