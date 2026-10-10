import type { CSSProperties } from "react";
import {
  IconAnnounce,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconClose,
  IconLock,
  IconMoon,
  IconPanelBottom,
  IconPanelTop,
  IconPlus,
  IconSuccess,
  IconSun,
  IconWarning,
} from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import { TextField } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { BRAND_COLOR_PRESETS, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "@/lib/brandColors";
import { checkAccent, labelOn, suggestAccent } from "@/lib/contrast";
import { STORE_SIDEBAR_ENABLED } from "@/lib/features";
import { formatMoney } from "@/lib/format";
import { useThemeFonts } from "@/lib/themeFonts";
import { ImageField } from "./ImageField";
import { useEditorLocale, type EditorLocale, type EditorUi } from "./editorLocale";
import {
  MAX_ANNOUNCEMENT_MESSAGES,
  PALETTES,
  accentOf,
  type RadiusKey,
  type StoreAnnouncementLook,
  type StoreLook,
} from "./storeLook";
import type { NavLayout, ShellPart } from "./storeShell";
import { ORIGINAL_LOOK, THEME_CHOICES, THEME_SPECS, accentGrounds, type ColorMode } from "./storeThemes";
import { ThemeSketch } from "./ThemeSketch";
import { ColorWell, SwatchRow } from "./theme/ColorWell";
import { IconCornerRound, IconCornerSharp, IconCornerSoft } from "./theme/CornerIcons";
import { LookBlock, LookCheck, SwitchRow, lookCardClass, lookIconButtonClass, lookTextButtonClass } from "./theme/parts";
import { FontPairList } from "./theme/FontPairList";
import { ThemePresetRow } from "./theme/ThemePresetRow";
import { useThemeCatalog } from "./theme/themeCatalog";
import { lookUi, themeUi } from "./theme/themeLocale";

// The ready styles, for the first-run "brand it" step and anything else that offers them.
export { THEME_PRESETS, applyThemePreset, matchesThemePreset, type ThemePreset } from "./theme/presets";
export { ThemePresetRow } from "./theme/ThemePresetRow";

/**
 * The theme panel — the inspector when nothing is selected, and «الشكل» on the
 * phone: how the whole store looks. Every change goes straight into the live
 * preview (as an unsaved look the frame lays over the saved one) and is
 * written to the workspace only when the editor saves the look — see
 * storeLook.ts for the keys. The panel itself saves nothing.
 *
 * Top to bottom, each a compact block:
 *  1. Ready styles — a theme, both accents, font and corners in one tap
 *     (theme/presets.ts); one change, so one undo step.
 *  2. Brand colour — the accent for light and for dark mode, each checked for
 *     contrast against the theme's own grounds (storeThemes.ts `accentGrounds`,
 *     lib/contrast.ts): a colour that is hard to read gets a warning and the
 *     nearest readable suggestion — never a block. Ready colours, and on the
 *     original look the ready pairs and the second colour.
 *  3. Font pair — pairs drawn in their own face, the store's uploaded fonts
 *     among them; any Google font and uploading under «خطوط أكتر».
 *  4. Corners — the original look only; a theme brings its own corners and
 *     its own button shape (the storefront reads no button setting).
 *  5. Logo.
 *  6. Theme — the layout families as drawn cards.
 *  7. Navigation — top bar or side bar on a wide screen, only while
 *     lib/features STORE_SIDEBAR_ENABLED is on.
 *
 * `onChange` takes a history key so a burst of typing in a colour box, or a
 * drag across the native colour picker, is one undo step.
 *
 * The announcement bar, header and footer are part of the look too, but each
 * has its own panel (ShellPanels.tsx), opened by clicking it in the preview or
 * in the section list; the foot of this panel points there.
 */

const CORNERS: Array<{ value: RadiusKey; icon: typeof IconCornerSharp }> = [
  { value: "sharp", icon: IconCornerSharp },
  { value: "soft", icon: IconCornerSoft },
  { value: "round", icon: IconCornerRound },
];

/** Ready accents for dark mode: the colours the themes themselves use there, so each reads on a dark page. */
const DARK_SWATCHES: readonly string[] = [...new Set(THEME_CHOICES.map((key) => THEME_SPECS[key].palette.dark.accent))];

/** Ready colours for text on the announcement bar: white and ink first. */
const BAR_TEXT_SWATCHES: readonly string[] = ["#FFFFFF", "#16211F", ...BRAND_COLOR_PRESETS];

const SHELL_PARTS = [
  ["announcement", IconAnnounce],
  ["header", IconPanelTop],
  ["footer", IconPanelBottom],
] as const;

export function StoreLookPanel({
  look,
  onChange,
  onEditShell,
  storeName = "",
  previewMode = "light",
  onPreviewMode,
  variant = "panel",
}: {
  look: StoreLook;
  onChange: (next: StoreLook, historyKey?: string) => void;
  /** Opens the announcement bar's, header's or footer's own panel. */
  onEditShell?: (part: ShellPart) => void;
  /** The specimen in each theme's thumbnail. */
  storeName?: string;
  /** The mode the preview is showing; the thumbnails follow it. */
  previewMode?: ColorMode;
  /** Switches the preview to the mode whose colour the merchant is changing. */
  onPreviewMode?: (mode: ColorMode) => void;
  /**
   * `panel` (the default) is the inspector column and brings its own gutter.
   * `sheet` is the same content for a phone bottom sheet: it takes the sheet
   * body's gutter instead of adding one, the ready styles run edge to edge as
   * a snap row, and the controls are a thumb tall.
   */
  variant?: "panel" | "sheet";
}) {
  const locale = useEditorLocale();
  const ui = lookUi(locale);
  const t = themeUi(locale);
  const catalog = useThemeCatalog();
  useThemeFonts();

  const sheet = variant === "sheet";
  const theme = look.storeTheme;
  const spec = THEME_SPECS[theme];
  const original = theme === ORIGINAL_LOOK;
  const lightAccent = accentOf(look);
  const accentFor = (mode: ColorMode) => (mode === "light" ? lightAccent : (look.primaryColorDark ?? lightAccent));

  function setAccent(mode: ColorMode, hex: string | null, historyKey?: string) {
    onPreviewMode?.(mode);
    onChange(
      mode === "light" ? { ...look, primaryColor: hex, primaryColorFromTemplate: false } : { ...look, primaryColorDark: hex },
      historyKey
    );
  }

  // The sheet's body already has a gutter (1.25rem); the shelf of ready styles bleeds through it to the screen's edges.
  const gutters = {
    "--look-gutter": sheet ? "0px" : "1rem",
    "--look-bleed": sheet ? "1.25rem" : "1rem",
  } as CSSProperties;

  return (
    <div data-slot="store-look" data-variant={variant} style={gutters} className="zimos-look">
      <p className="px-[var(--look-gutter)] pt-3 text-xs text-ink-soft">{ui.lookHint}</p>

      <LookBlock title={t.presets} hint={t.presetsHint}>
        <ThemePresetRow
          look={look}
          onChange={onChange}
          storeName={storeName}
          previewMode={previewMode}
          variant={variant}
        />
      </LookBlock>

      <LookBlock title={t.brandColor} hint={ui.accentColorsHint}>
        {original ? (
          <div
            role="group"
            aria-label={ui.palettes}
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] pointer-coarse:gap-2 [&::-webkit-scrollbar]:hidden"
          >
            {PALETTES.map((palette) => {
              const name = ui.paletteName(palette.key);
              const active = lightAccent === palette.primary && look.secondaryColor === palette.secondary;
              return (
                <button
                  key={palette.key}
                  type="button"
                  aria-pressed={active}
                  aria-label={ui.usePalette(name)}
                  title={name}
                  onClick={() =>
                    onChange({
                      ...look,
                      primaryColor: palette.primary,
                      primaryColorFromTemplate: false,
                      secondaryColor: palette.secondary,
                    })
                  }
                  className={cn(
                    "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 ring-black/10 ring-inset",
                    "transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:scale-110 active:scale-[0.97]",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    "pointer-coarse:size-11 dark:ring-white/20 motion-reduce:transition-none"
                  )}
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${palette.primary} 0 60%, ${palette.secondary} 60% 100%)`,
                    color: labelOn(palette.primary),
                  }}
                >
                  {active && <IconCheck className="size-3.5" aria-hidden />}
                </button>
              );
            })}
          </div>
        ) : (
          <SwatchRow
            colors={BRAND_COLOR_PRESETS}
            value={lightAccent}
            label={ui.palettes}
            onPick={(hex) => setAccent("light", hex)}
          />
        )}

        {(["light", "dark"] as const).map((mode) => {
          const own = mode === "light" ? lightAccent : look.primaryColorDark;
          const effective = accentFor(mode) ?? spec.palette[mode].accent;
          const hint =
            mode === "light"
              ? own
                ? ui.accentLightHint
                : ui.themeDefaultColor
              : own
                ? ui.accentDarkHint
                : lightAccent
                  ? ui.accentDarkFollows
                  : ui.themeDefaultColor;
          return (
            <div key={mode} className="zimos-look-row rounded-[0.875rem] bg-paper-raised p-3 ring-1 ring-line">
              <ColorWell
                label={mode === "light" ? ui.lightMode : ui.darkMode}
                icon={
                  mode === "light" ? (
                    <IconSun className="size-4 shrink-0 text-ink-soft" aria-hidden />
                  ) : (
                    <IconMoon className="size-4 shrink-0 text-ink-soft" aria-hidden />
                  )
                }
                hint={hint}
                value={accentFor(mode)}
                fallback={spec.palette[mode].accent}
                onChange={(hex) => setAccent(mode, hex, `look:accent:${mode}`)}
                swatches={mode === "dark" ? DARK_SWATCHES : original ? BRAND_COLOR_PRESETS : undefined}
              >
                {mode === "dark" && own && (
                  <button type="button" onClick={() => setAccent("dark", null)} className={lookTextButtonClass}>
                    {ui.matchLightMode}
                  </button>
                )}
                <ContrastNote
                  ui={ui}
                  locale={locale}
                  mode={mode}
                  accent={effective}
                  grounds={accentGrounds(theme, mode, effective)}
                  onUse={(hex) => setAccent(mode, hex)}
                />
              </ColorWell>
            </div>
          );
        })}

        {original && (
          <div className="zimos-look-row rounded-[0.875rem] bg-paper-raised p-3 ring-1 ring-line">
            <ColorWell
              label={ui.secondColor}
              hint={look.secondaryColor ? ui.secondColorHint : ui.storeDefaultColor}
              value={look.secondaryColor}
              fallback={DEFAULT_SECONDARY}
              onChange={(hex) => onChange({ ...look, secondaryColor: hex }, "look:secondary")}
              swatches={BRAND_COLOR_PRESETS}
            />
          </div>
        )}
      </LookBlock>

      {/* A theme brings its own type; the original look chooses one of its pairings. */}
      {original && (
        <LookBlock title={t.fontPair} hint={t.fontPairHint}>
          <FontPairList look={look} onChange={onChange} variant={variant} />
        </LookBlock>
      )}

      <LookBlock title={ui.corners}>
        {original ? (
          <Segmented
            value={look.cornerRadius}
            onChange={(cornerRadius) => onChange({ ...look, cornerRadius })}
            options={CORNERS.map((option) => ({
              value: option.value,
              label: ui.radiusName(option.value),
              icon: option.icon,
            }))}
            label={ui.corners}
            size={sheet ? "md" : "sm"}
            className="w-full"
          />
        ) : (
          // A theme owns its corners and its buttons: nothing here would reach the store.
          <p className="text-xs text-ink-soft">{t.cornersFromTheme(catalog.name(theme, locale))}</p>
        )}
      </LookBlock>

      <LookBlock>
        <ImageField
          label={ui.logo}
          hint={ui.logoHint}
          value={look.logoUrl ?? ""}
          onChange={(url) => onChange({ ...look, logoUrl: url || null })}
        />
      </LookBlock>

      <LookBlock title={ui.theme}>
        <div
          role="radiogroup"
          aria-label={ui.theme}
          className={cn("grid gap-2", sheet ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}
        >
          {THEME_CHOICES.filter((key) => catalog.offered(key, theme)).map((key) => {
            const active = theme === key;
            const name = catalog.name(key, locale);
            // Paid and not this store's: a save would be refused, so it cannot be picked here.
            const price = active ? null : catalog.price(key);
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={name}
                aria-disabled={price ? true : undefined}
                title={price ? t.themePaidNote : catalog.description(key, locale)}
                onClick={() => {
                  if (!active && !price) onChange({ ...look, storeTheme: key });
                }}
                className={lookCardClass}
              >
                <ThemeSketch
                  theme={key}
                  mode={previewMode}
                  accent={previewMode === "light" ? accentOf(look, key) : (look.primaryColorDark ?? accentOf(look, key))}
                  title={storeName || name}
                  corners={look.cornerRadius}
                  secondary={look.secondaryColor}
                />
                <span className="flex min-h-9 items-center gap-1.5 border-t border-line px-2.5 py-1.5 text-xs font-medium text-ink">
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {price && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-ink">
                      <IconLock className="size-3" aria-hidden />
                      {formatMoney(price.amount, price.currency)}
                    </span>
                  )}
                  {active && <LookCheck />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-soft">
          <span className="font-medium text-ink">{catalog.name(theme, locale)}</span> —{" "}
          {catalog.description(theme, locale)}
        </p>
        <p className="text-xs text-ink-soft">{original ? ui.themeOriginalHint : ui.themeHint}</p>
      </LookBlock>

      {/* Where the store's navigation sits on a wide screen (lib/features); saved with the header, as `header.layout`. */}
      {STORE_SIDEBAR_ENABLED && (
        <LookBlock title={ui.navLayout} hint={ui.navLayoutHint}>
          <Segmented<NavLayout>
            value={look.header.layout}
            onChange={(layout) => onChange({ ...look, header: { ...look.header, layout } })}
            options={(["top", "side"] as const).map((value) => ({ value, label: ui.navLayoutName(value) }))}
            label={ui.navLayout}
            size={sheet ? "md" : "sm"}
            className="w-full"
          />
        </LookBlock>
      )}

      {onEditShell && (
        <LookBlock title={t.shellTitle} hint={ui.shellEditHint}>
          <div className="grid grid-cols-3 gap-2">
            {SHELL_PARTS.map(([part, PartIcon]) => (
              <button
                key={part}
                type="button"
                onClick={() => onEditShell(part)}
                className={cn(
                  lookCardClass,
                  "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 px-1.5 py-2 text-center text-xs font-medium text-ink"
                )}
              >
                <PartIcon className="size-5 text-ink-soft" aria-hidden />
                <span className="max-w-full truncate">
                  {part === "header" ? ui.shellHeader : part === "footer" ? ui.shellFooter : ui.announcementBar}
                </span>
              </button>
            ))}
          </div>
        </LookBlock>
      )}
    </div>
  );
}

function ratio(value: number, locale: EditorLocale): string {
  const tag = locale === "ar" ? "ar-EG" : "en-US";
  const tenths = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${tenths.format(Math.floor(value * 10) / 10)} : ${new Intl.NumberFormat(tag).format(1)}`;
}

/**
 * Whether the accent reads well in this mode — and, when it doesn't, why and
 * the nearest colour that does. A warning, never a block: the merchant can
 * keep their colour and save.
 */
function ContrastNote({
  ui,
  locale,
  mode,
  accent,
  grounds,
  onUse,
}: {
  ui: EditorUi;
  locale: EditorLocale;
  mode: ColorMode;
  accent: string;
  grounds: ReturnType<typeof accentGrounds>;
  onUse: (hex: string) => void;
}) {
  const check = checkAccent(accent, grounds);
  if (check.ok) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-success">
        <IconSuccess className="mt-px size-3.5 shrink-0" aria-hidden />
        {ui.contrastOk(ratio(check.label, locale), ratio(Math.min(check.onPage, check.onCard), locale))}
      </p>
    );
  }
  const suggestion = suggestAccent(accent, grounds, mode);
  return (
    <div role="status" className="space-y-1.5 rounded-[0.75rem] border border-accent/50 bg-accent-soft px-2.5 py-2 text-xs text-ink">
      <p className="flex items-center gap-1.5 font-semibold">
        <IconWarning className="size-3.5 shrink-0 text-accent-dark" aria-hidden />
        {ui.contrastLow(mode)}
      </p>
      <ul className="space-y-0.5 ps-5 text-ink-soft">
        {check.failing.includes("label") && <li>{ui.contrastLabel(ratio(check.label, locale))}</li>}
        {check.failing.includes("text") && (
          <li>{ui.contrastText(ratio(Math.min(check.onPage, check.onCard), locale))}</li>
        )}
      </ul>
      <p className="text-ink-soft">{ui.contrastTarget}</p>
      {suggestion ? (
        <button
          type="button"
          onClick={() => onUse(suggestion)}
          aria-label={ui.contrastUseAria(suggestion, mode)}
          className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-paper-raised px-2.5 font-medium text-ink ring-1 ring-line transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] pointer-coarse:min-h-11 motion-reduce:transition-none"
        >
          <span className="size-3.5 rounded-full ring-1 ring-line" style={{ backgroundColor: suggestion }} aria-hidden />
          {ui.contrastUse}
          {/* Isolated: after Arabic words the digits of a hex code would otherwise reorder ("B00 … #826"). */}
          <bdi dir="ltr" className="font-mono">
            {suggestion}
          </bdi>
        </button>
      ) : (
        <p className="text-ink-soft">{ui.contrastNoSuggestion}</p>
      )}
    </div>
  );
}

/** All-blank (or empty) messages, the one state a save can't keep "on" — see storeLook.ts's `announcementPatch`. */
function announcementIsBlank(messages: string[]): boolean {
  return messages.every((m) => m.trim() === "");
}

/**
 * The announcement bar's fields — its own panel in the inspector (see
 * ShellPanels.tsx). `onChange` takes a history key, so typing a message or a
 * link, or dragging across a colour, is one undo step rather than one per
 * letter.
 */
export function AnnouncementSection({
  announcement,
  onChange,
  bare = false,
}: {
  announcement: StoreAnnouncementLook;
  onChange: (next: StoreAnnouncementLook, historyKey?: string) => void;
  /** No top rule — the section is a panel of its own rather than the foot of another. */
  bare?: boolean;
}) {
  const ui = lookUi(useEditorLocale());

  return (
    <section className={bare ? "space-y-3" : "space-y-3 border-t border-line pt-4"}>
      <SwitchRow
        strong
        label={ui.announcementBar}
        hint={ui.announcementBarHint}
        checked={announcement.enabled}
        onChange={(enabled) => onChange({ ...announcement, enabled })}
      />

      {announcement.enabled && (
        <div className="space-y-4">
          <AnnouncementMessages
            messages={announcement.messages}
            ui={ui}
            onChange={(messages) => onChange({ ...announcement, messages }, "look:announcement:messages")}
          />
          {announcementIsBlank(announcement.messages) && (
            <p className="text-xs font-medium text-danger">{ui.announcementNeedsMessage}</p>
          )}

          <TextField
            label={ui.announcementLink}
            hint={ui.announcementLinkHint}
            dir="ltr"
            value={announcement.href ?? ""}
            onChange={(e) =>
              onChange({ ...announcement, href: e.target.value.trim() ? e.target.value : null }, "look:announcement:href")
            }
          />

          <ColorWell
            label={ui.announcementBackground}
            hint={announcement.background ? ui.announcementColorSetHint : ui.storeDefaultColor}
            value={announcement.background}
            fallback={DEFAULT_PRIMARY}
            onChange={(hex) => onChange({ ...announcement, background: hex }, "look:announcement:background")}
            swatches={BRAND_COLOR_PRESETS}
          />
          <ColorWell
            label={ui.announcementTextColor}
            hint={announcement.color ? ui.announcementColorSetHint : ui.storeDefaultColor}
            value={announcement.color}
            fallback="#FFFFFF"
            onChange={(hex) => onChange({ ...announcement, color: hex }, "look:announcement:color")}
            swatches={BAR_TEXT_SWATCHES}
          />
        </div>
      )}
    </section>
  );
}

/**
 * The repeatable message list: add / remove / reorder, at least one row shown
 * always (removing the last one is a no-op — clearing text is how a merchant
 * empties it), capped at `MAX_ANNOUNCEMENT_MESSAGES`. The up / down and remove
 * buttons are a thumb wide on touch; with a single message there is nothing to
 * reorder, so the arrows are not drawn.
 */
function AnnouncementMessages({
  messages,
  ui,
  onChange,
}: {
  messages: string[];
  ui: EditorUi;
  onChange: (next: string[]) => void;
}) {
  const list = messages.length > 0 ? messages : [""];

  function set(i: number, value: string) {
    onChange(list.map((m, j) => (j === i ? value : m)));
  }
  function add() {
    if (list.length >= MAX_ANNOUNCEMENT_MESSAGES) return;
    onChange([...list, ""]);
  }
  function remove(i: number) {
    if (list.length <= 1) return;
    onChange(list.filter((_, j) => j !== i));
  }
  function move(i: number, direction: "up" | "down") {
    const to = direction === "up" ? i - 1 : i + 1;
    if (to < 0 || to >= list.length) return;
    const next = list.slice();
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{ui.announcementMessages}</p>
      <ul className="space-y-2">
        {list.map((message, i) => (
          <li key={i} className="flex items-center gap-0.5">
            <Input
              value={message}
              dir="auto"
              placeholder={ui.announcementMessagePlaceholder}
              aria-label={ui.announcementMessageAria(i + 1)}
              onChange={(e) => set(i, e.target.value)}
              className="me-1 min-w-0 flex-1"
            />
            {list.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label={ui.announcementMoveUp(i + 1)}
                  title={ui.announcementMoveUp(i + 1)}
                  disabled={i === 0}
                  onClick={() => move(i, "up")}
                  className={lookIconButtonClass}
                >
                  <IconArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={ui.announcementMoveDown(i + 1)}
                  title={ui.announcementMoveDown(i + 1)}
                  disabled={i === list.length - 1}
                  onClick={() => move(i, "down")}
                  className={lookIconButtonClass}
                >
                  <IconArrowDown className="size-4" aria-hidden />
                </button>
              </>
            )}
            <button
              type="button"
              aria-label={ui.announcementRemoveMessage(i + 1)}
              title={ui.announcementRemoveMessage(i + 1)}
              disabled={list.length <= 1}
              onClick={() => remove(i)}
              className={lookIconButtonClass}
            >
              <IconClose className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={add}
        disabled={list.length >= MAX_ANNOUNCEMENT_MESSAGES}
      >
        <IconPlus className="size-4" aria-hidden />
        {ui.announcementAddMessage}
      </Button>
    </div>
  );
}
