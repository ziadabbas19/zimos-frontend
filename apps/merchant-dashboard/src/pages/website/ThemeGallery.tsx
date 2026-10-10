import { useMemo, useState } from "react";
import { IconCheck, IconMoon, IconSun } from "@/components/icons";
import { Alert, Button, cn } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { useThemeFonts } from "@/lib/themeFonts";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { accentOf, lookToPreview, readStoreLook } from "./editor/storeLook";
import { ORIGINAL_LOOK, THEME_CHOICES, THEME_SPECS, type ColorMode, type ThemeChoice } from "./editor/storeThemes";
import { ThemeSketch } from "./editor/ThemeSketch";
import { themesList, type CatalogTheme } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { FilterTabs } from "@/components/FilterTabs";
import { themeShowcaseTree } from "./themeShowcase";
import { ThemeResetButton, ThemeTags, useStyleFilterText, useTagLabel } from "./ThemeExtras";
import { Select } from "@/components/Select";
import { DevicePreview } from "./gallery/DevicePreview";
import { useMountedOpen } from "./gallery/useMountedOpen";

const STRINGS = {
  en: {
    title: "Store theme",
    note: "How your whole store looks — fonts, corners, buttons, cards and the opening section. Your accent colours stay yours.",
    modes: "Show the themes in",
    light: "Light mode",
    dark: "Dark mode",
    current: "Current",
    previewOf: "Try the {name} theme",
    livePreview: "Your store in the {name} theme",
    fixed: "Fonts, corners, buttons, cards, spacing and the opening section come from the theme.",
    yours: "Your accent colour — one for light mode, one for dark — stays yours. Set it in the editor, under Store look.",
    previewNote: "Your store's name and products, in this theme. It goes live as soon as you use it — no publishing needed.",
    use: "Use this theme",
    using: "Applying…",
    inUse: "This is your store's theme",
    applied: "{name} is now your store's theme.",
    cancel: "Cancel",
    filter: "Show",
    all: "All",
    free: "Free",
    paid: "Paid",
    category: "Category",
    anyCategory: "All kinds",
    paidNote: "Paid themes can't be bought yet — they will be soon.",
    noMatch: "No themes match these filters.",
    showAll: "Show all themes",
    cat_general: "General",
    cat_fashion: "Fashion",
    cat_electronics: "Electronics",
    cat_furniture: "Furniture",
    cat_beauty: "Beauty",
    cat_kids: "Kids",
    cat_pets: "Pets",
  },
  ar: {
    title: "ثيم المتجر",
    note: "شكل متجرك كله — الخطوط والحواف والأزرار والبطاقات وقسم الواجهة. وتبقى ألوان التمييز من اختيارك.",
    modes: "اعرض الثيمات في",
    light: "الوضع الفاتح",
    dark: "الوضع الداكن",
    current: "الحالي",
    previewOf: "جرّب ثيم {name}",
    livePreview: "متجرك بثيم {name}",
    fixed: "الخطوط والحواف والأزرار والبطاقات والمسافات وقسم الواجهة يحددها الثيم.",
    yours: "لون التمييز — واحد للوضع الفاتح وآخر للداكن — يبقى من اختيارك، وتضبطه من المحرر في «مظهر المتجر».",
    previewNote: "اسم متجرك ومنتجاتك بهذا الثيم. يُطبَّق على متجرك فور استخدامه — دون نشر.",
    use: "استخدم هذا الثيم",
    using: "جارٍ التطبيق…",
    inUse: "هذا ثيم متجرك الحالي",
    applied: "أصبح «{name}» ثيم متجرك.",
    cancel: "إلغاء",
    filter: "اعرض",
    all: "الكل",
    free: "مجانية",
    paid: "مدفوعة",
    category: "النوع",
    anyCategory: "كل الأنواع",
    paidNote: "الثيمات المدفوعة مش متاحة للشراء لسه — قريب.",
    noMatch: "لا توجد ثيمات بهذه الفلاتر.",
    showAll: "عرض كل الثيمات",
    cat_general: "عام",
    cat_fashion: "أزياء",
    cat_electronics: "إلكترونيات",
    cat_furniture: "أثاث",
    cat_beauty: "تجميل",
    cat_kids: "أطفال",
    cat_pets: "حيوانات أليفة",
  },
} satisfies Messages;

/**
 * The store themes (storeThemes.ts). A theme is the store's whole look,
 * whatever template its pages started from, and is saved to the workspace —
 * the same `themeSettings.storeTheme` the editor's Store look panel writes.
 *
 * Each card is a drawing of the theme (no server render, so the gallery stays
 * light); trying one renders the real storefront — the store's own name and
 * products on a page built from the editor's presets — in that theme, in
 * either mode and on a phone or a computer, before anything is saved.
 *
 * `variant="section"` (the default) is the gallery with its own heading, as a
 * part of a page. `variant="sheet"` leaves the heading to the sheet around it
 * (the website page opens it from «شكل المتجر» → «غيّر»). Two cards to a row
 * on a phone either way.
 */
export function ThemeGallery({ variant = "section" }: { variant?: "section" | "sheet" } = {}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const [mode, setMode] = useState<ColorMode>("light");
  // The theme being tried stays while its dialog slides away; `trying` is what closes it.
  const [selected, setSelected] = useState<ThemeChoice | null>(null);
  const [trying, setTrying] = useState(false);
  const [price, setPrice] = useState<"all" | "free" | "paid">("all");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const tagLabel = useTagLabel();
  const styleText = useStyleFilterText();
  // The platform's catalog (themes/themesCatalog.js): which themes, in what order, named how, at what price.
  const catalog = useAsync(() => themesList(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const entries = useMemo(() => new Map((catalog.data?.themes ?? []).map((e) => [e.key, e])), [catalog.data]);
  const offered: ThemeChoice[] = catalog.data
    ? catalog.data.themes.map((e) => e.key).filter((k): k is ThemeChoice => (THEME_CHOICES as readonly string[]).includes(k))
    : [...THEME_CHOICES];
  const categories = [...new Set(offered.map((k) => entries.get(k)?.category).filter((c): c is string => !!c))];
  // Every tag the offered themes carry (the console sets them), for the style filter.
  const tags = [...new Set(offered.flatMap((k) => entries.get(k)?.tags ?? []))].sort();
  // Free / paid only means something once a theme has a price (or the filter is already set).
  const hasPaid = offered.some((k) => !!entries.get(k)?.price) || price !== "all";
  const shown = offered.filter((k) => {
    const e = entries.get(k);
    if (price === "free" && e?.price) return false;
    if (price === "paid" && !e?.price) return false;
    if (tag && !(e?.tags ?? []).includes(tag)) return false;
    return !category || e?.category === category;
  });
  const nameOf = (k: ThemeChoice) => entries.get(k)?.name[locale] || THEME_SPECS[k].name[locale];
  const descriptionOf = (k: ThemeChoice) => entries.get(k)?.description[locale] || THEME_SPECS[k].description[locale];
  useThemeFonts();

  const look = useMemo(() => readStoreLook(currentWorkspace), [currentWorkspace]);
  // What each theme would paint with: a template's colour never counts on a theme.
  const accentUnder = (theme: ThemeChoice) =>
    mode === "light" ? accentOf(look, theme) : (look.primaryColorDark ?? accentOf(look, theme));
  const storeName = currentWorkspace?.name ?? "";
  const section = variant === "section";
  const filtered = price !== "all" || category !== "" || tag !== "";

  return (
    <section
      data-slot="theme-gallery"
      data-variant={variant}
      aria-labelledby={section ? "store-theme-title" : undefined}
      aria-label={section ? undefined : t.title}
      className={section ? "mb-10" : undefined}
    >
      {section && (
        <div className="mb-3 max-w-2xl">
          <h2 id="store-theme-title" className="font-display text-base font-medium text-ink">
            {t.title}
          </h2>
          <p className="mt-1 text-xs text-ink-soft">{t.note}</p>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {hasPaid && (
          <FilterTabs
            label={t.filter}
            value={price}
            onChange={setPrice}
            buttonClassName="pointer-coarse:min-h-11"
            tabs={[
              { value: "all", label: t.all },
              { value: "free", label: t.free },
              { value: "paid", label: t.paid },
            ]}
          />
        )}
        {categories.length > 1 && (
          <FilterTabs
            label={t.category}
            value={category}
            onChange={setCategory}
            buttonClassName="pointer-coarse:min-h-11"
            tabs={[{ value: "", label: t.anyCategory }, ...categories.map((c) => ({ value: c, label: (t as Record<string, string>)[`cat_${c}`] ?? c }))]}
          />
        )}
        {tags.length > 1 && (
          <Select aria-label={styleText.style} value={tag} onChange={(e) => setTag(e.target.value)} className="h-10 w-auto pointer-coarse:h-11">
            <option value="">{styleText.anyStyle}</option>
            {tags.map((value) => (
              <option key={value} value={value}>
                {tagLabel(value)}
              </option>
            ))}
          </Select>
        )}
        <div className="ms-auto">
          <ModeSwitch mode={mode} onChange={setMode} label={t.modes} light={t.light} dark={t.dark} />
        </div>
      </div>

      {shown.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper-sunken px-4 py-3 text-sm text-ink-soft">
          <span>{t.noMatch}</span>
          {filtered && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full px-4"
              onClick={() => {
                setPrice("all");
                setCategory("");
                setTag("");
              }}
            >
              {t.showAll}
            </Button>
          )}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {shown.map((key) => {
          const name = nameOf(key);
          const entry = entries.get(key);
          const current = look.storeTheme === key;
          return (
            <li
              key={key}
              data-slot="theme-card"
              data-current={current ? "" : undefined}
              className={cn(
                "zimos-theme-card relative flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1",
                current ? "ring-primary" : "ring-line",
                "transition-[translate,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "hover:-translate-y-0.5 has-[[data-theme-open]:active]:scale-[0.97] motion-reduce:hover:translate-y-0 motion-reduce:has-[[data-theme-open]:active]:scale-100",
                "has-[[data-theme-open]:focus-visible]:outline-2 has-[[data-theme-open]:focus-visible]:outline-offset-2 has-[[data-theme-open]:focus-visible]:outline-primary"
              )}
            >
              <div className="relative">
                <ThemeSketch theme={key} mode={mode} accent={accentUnder(key)} title={storeName || name} />
                {current && (
                  <span className="zimos-template-current absolute start-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-primary ps-1.5 pe-2.5 text-xs leading-none font-semibold text-primary-foreground shadow-[var(--shadow-card)]">
                    <IconCheck className="size-3.5" aria-hidden />
                    {t.current}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 border-t border-line px-3 pt-2.5 pb-3">
                <button
                  type="button"
                  data-theme-open=""
                  aria-haspopup="dialog"
                  onClick={() => {
                    setSelected(key);
                    setTrying(true);
                  }}
                  aria-label={fmt(t.previewOf, { name })}
                  className="block w-full min-w-0 cursor-pointer truncate text-start text-sm leading-5 font-semibold text-ink outline-none after:absolute after:inset-0 after:content-['']"
                >
                  {name}
                </button>
                <span className="line-clamp-2 text-xs leading-4 text-ink-soft">{descriptionOf(key)}</span>
                {/* On a phone a card is two fingers wide: its tags wait in the preview. */}
                <div className="max-sm:hidden">
                  <ThemeTags tags={entry?.tags ?? []} />
                </div>
                {entry?.price && !entry.owned && (
                  <span className="text-xs font-medium text-accent-dark">{formatMoney(entry.price.amount, entry.price.currency)}</span>
                )}
                {/* Back to the theme's own look (ThemeExtras.tsx). Above the card's press area: it is its own button. */}
                {current && (
                  <span className="mt-auto pt-1">
                    <ThemeResetButton />
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {selected && (
        <ThemePreview
          key={selected}
          theme={selected}
          name={nameOf(selected)}
          description={descriptionOf(selected)}
          entry={entries.get(selected) ?? null}
          initialMode={mode}
          open={trying}
          onDone={() => {
            setTrying(false);
            void catalog.refresh({ silent: true });
          }}
        />
      )}
    </section>
  );
}

function ModeSwitch({
  mode,
  onChange,
  label,
  light,
  dark,
}: {
  mode: ColorMode;
  onChange: (mode: ColorMode) => void;
  label: string;
  light: string;
  dark: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {(
        [
          ["light", light, IconSun],
          ["dark", dark, IconMoon],
        ] as const
      ).map(([value, text, Icon]) => (
        <Button
          key={value}
          type="button"
          size="icon"
          variant={mode === value ? "secondary" : "ghost"}
          aria-label={text}
          title={text}
          aria-pressed={mode === value}
          className="rounded-full pointer-coarse:size-11"
          onClick={() => onChange(value)}
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      ))}
    </div>
  );
}

/** Both actions are pills; the footer of the dialog gives them their height (44px rows on the phone). */
const ACTION = "rounded-full px-5";

/** The dialog of one theme: the real storefront in it, and the switch to it. */
function ThemePreview({
  theme,
  name,
  description,
  entry,
  initialMode,
  open,
  onDone,
}: {
  theme: ThemeChoice;
  name: string;
  description: string;
  /** Its catalog row: a paid one the store doesn't own can't be used yet. */
  entry: CatalogTheme | null;
  initialMode: ColorMode;
  open: boolean;
  onDone: () => void;
}) {
  const locked = !!entry?.price && !entry.owned;
  const t = useT(STRINGS);
  // Mounted by the press that opens it: closed for one frame, so it rises like every other dialog.
  const shown = useMountedOpen(open);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const saveThemeSettings = useSaveThemeSettings();
  const toast = useToast();
  const [mode, setMode] = useState<ColorMode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = THEME_SPECS[theme];
  const saved = useMemo(() => readStoreLook(currentWorkspace), [currentWorkspace]);
  const current = saved.storeTheme === theme;
  // The store's own look with only the theme swapped: its accents, and on the
  // original look its font, corners and second colour.
  const previewTheme = useMemo(() => lookToPreview({ ...saved, storeTheme: theme }), [saved, theme]);
  const page = useMemo(
    () => themeShowcaseTree({ name: currentWorkspace?.name ?? "", tagline: currentWorkspace?.tagline }, locale),
    // Rebuilt only when the words on it change: a new tree is a new render.
    [currentWorkspace?.name, currentWorkspace?.tagline, locale]
  );

  async function use() {
    setSaving(true);
    setError(null);
    try {
      await saveThemeSettings((current) => {
        // Merge, never replace: themeSettings is a blob other screens write to too.
        const themeSettings: Record<string, unknown> = { ...current };
        if (theme === ORIGINAL_LOOK) delete themeSettings.storeTheme;
        else themeSettings.storeTheme = theme;
        return { themeSettings };
      });
      toast.success(fmt(t.applied, { name: spec.name[locale] }));
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={shown}
      onClose={() => {
        if (!saving) onDone();
      }}
      title={name}
      description={description}
      className="max-w-5xl"
      footer={
        <>
          <Button type="button" variant="outline" className={ACTION} onClick={onDone} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="button" className={ACTION} onClick={use} disabled={saving || current || locked}>
            {current ? t.inUse : saving ? t.using : t.use}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <DevicePreview
          workspaceId={workspaceId}
          templateId={`theme:${theme}`}
          page={page}
          theme={previewTheme}
          colorMode={mode}
          title={fmt(t.livePreview, { name: spec.name[locale] })}
          fallback={<ThemeSketch theme={theme} mode={mode} title={currentWorkspace?.name || spec.name[locale]} className="h-full" />}
          controls={<ModeSwitch mode={mode} onChange={setMode} label={t.modes} light={t.light} dark={t.dark} />}
          stageClassName="h-[min(56dvh,34rem)] min-h-[20rem]"
        />

        <div className="space-y-3 text-sm">
          {error && <Alert variant="danger">{error}</Alert>}
          {locked && <Alert>{t.paidNote}</Alert>}
          <p className="leading-6 text-ink-soft">{t.previewNote}</p>
          <ThemeTags tags={entry?.tags ?? []} />
          <ul className="space-y-2 text-ink-soft">
            <li className="rounded-2xl bg-paper-sunken px-3 py-2 leading-6">{t.fixed}</li>
            <li className="rounded-2xl bg-paper-sunken px-3 py-2 leading-6">{t.yours}</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
