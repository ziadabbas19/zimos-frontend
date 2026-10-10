import { useMemo, useState } from "react";
import { themesList } from "@store-builder/api-client";
import { Button } from "@store-builder/ui";
import { Sheet } from "@/components/Sheet";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { accentOf, readStoreLook } from "../editor/storeLook";
import { THEME_SPECS } from "../editor/storeThemes";
import { ThemeSketch } from "../editor/ThemeSketch";
import { ThemeGallery } from "../ThemeGallery";

const STRINGS = {
  en: {
    title: "Store look",
    note: "How your whole store looks — fonts, corners, buttons and cards. A look goes live as soon as you use it.",
    change: "Change",
    changeLabel: "Change the store's look",
  },
  ar: {
    title: "مظهر المتجر",
    note: "مظهر متجرك كله — الخطوط والحواف والأزرار والبطاقات. يُطبَّق المظهر على المتجر فور استخدامه.",
    change: "تغيير",
    changeLabel: "تغيير مظهر المتجر",
  },
} satisfies Messages;

/**
 * The store looks (ThemeGallery) in a sheet: the same gallery as before — its
 * filters, the light / dark specimens, try-it-live and "use this theme" — one
 * tap away instead of a screen and a half on the page. The editor's theme
 * panel offers the same choice.
 */
export function StoreThemeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(STRINGS);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t.title} description={t.note} size="lg" className="max-sm:h-[92dvh]">
      <ThemeGallery variant="sheet" />
    </Sheet>
  );
}

/**
 * «شكل المتجر» as one compact row: a drawing of the look the store wears now,
 * its name, and «غيّر», which opens the gallery in a sheet. The look is the
 * store's (themeSettings.storeTheme), whatever template its pages started
 * from — which is why it is not part of the templates grid below.
 */
export function StoreThemeRow({ className }: { className?: string }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const look = useMemo(() => readStoreLook(currentWorkspace), [currentWorkspace]);
  // The platform's catalogue may name a look differently from the built-in list; without it the built-in name stands.
  const catalog = useCachedAsync(
    `website:themes:${workspaceId}`,
    () => themesList(apiClient, workspaceId).catch(() => null),
    [workspaceId]
  );
  const entry = catalog.data?.themes.find((theme) => theme.key === look.storeTheme);
  const spec = THEME_SPECS[look.storeTheme];
  const name = entry?.name[locale] || spec.name[locale];
  const description = entry?.description[locale] || spec.description[locale];

  return (
    <section
      data-slot="store-theme-row"
      aria-label={t.title}
      className={
        "zimos-theme-row flex min-w-0 items-center gap-3 rounded-[var(--radius-card)] bg-paper-raised p-3 shadow-[var(--shadow-card)] ring-1 ring-line sm:gap-4 sm:p-3.5" +
        (className ? ` ${className}` : "")
      }
    >
      <div className="w-[4.5rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-line sm:w-24">
        <ThemeSketch theme={look.storeTheme} mode="light" accent={accentOf(look)} title={currentWorkspace?.name || name} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-4 text-ink-soft">{t.title}</p>
        <p className="truncate text-[15px] leading-6 font-semibold text-ink">{name}</p>
        <p className="hidden truncate text-[13px] leading-5 text-ink-soft sm:block">{description}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        aria-label={t.changeLabel}
        className="min-h-11 shrink-0 rounded-full px-4"
        onClick={() => setOpen(true)}
      >
        {t.change}
      </Button>
      <StoreThemeSheet open={open} onOpenChange={setOpen} />
    </section>
  );
}
