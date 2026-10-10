import { useId, useMemo, useState } from "react";
import type { Website, WebsiteTemplateSummary } from "@store-builder/api-client";
import { Button, cn } from "@store-builder/ui";
import { IconSearch } from "@/components/icons";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ChipRow, ListToolbar, type ChipItem } from "@/components/list";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { pluralOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { ALL_CATEGORIES, normalizeSearch, templateCategories } from "../templateGallery";
import { useCodeLabel } from "./codes";
import { TemplateCard } from "./TemplateCard";
import { TemplateSheet } from "./TemplateSheet";

const STRINGS = {
  en: {
    title: "Templates",
    count_one: "1 template",
    count_other: "{n} templates",
    search: "Search templates",
    searchPlaceholder: "Search by name or kind",
    filterLabel: "Filter templates by category",
    all: "All",
    noTemplates: "No website templates are available right now. Check back soon.",
    noMatchTitle: "No templates match",
    noMatchDescription: "Try another name, or show every kind.",
    clearFilters: "Show all templates",
    showAll: "Show all ({n})",
    showLess: "Show fewer",
  },
  ar: {
    title: "القوالب",
    count_one: "قالب واحد",
    count_two: "قالبان",
    count_few: "{n} قوالب",
    count_other: "{n} قالبًا",
    search: "ابحث في القوالب",
    searchPlaceholder: "ابحث باسم القالب أو نوعه",
    filterLabel: "تصفية القوالب حسب النوع",
    all: "الكل",
    noTemplates: "لا توجد قوالب مواقع متاحة الآن. عُد لاحقًا.",
    noMatchTitle: "لا توجد قوالب مطابقة",
    noMatchDescription: "جرّب اسمًا آخر، أو اعرض كل الأنواع.",
    clearFilters: "عرض كل القوالب",
    showAll: "عرض الكل ({n})",
    showLess: "عرض أقل",
  },
} satisfies Messages;

/** How many cards the page shows before «اعرض الكل»: two rows of four on a desktop, four rows of two on a phone. */
const FIRST_CARDS = 8;

/** Two columns on a phone — the cards are portraits, so two fit — three from 640px, four from 1024px. */
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";

/** The section while the catalogue loads: the toolbar, the chips and the first cards, in their own shapes. */
function GallerySkeleton() {
  return (
    <div>
      <SkeletonBar className="h-11 w-full" />
      <div className="mt-3 flex gap-2">
        <SkeletonBar className="h-10 w-16" />
        <SkeletonBar className="h-10 w-24" />
        <SkeletonBar className="h-10 w-20" />
      </div>
      <div className={cn(GRID, "mt-4")}>
        {Array.from({ length: FIRST_CARDS }, (_, i) => (
          <div
            key={i}
            data-slot="skeleton-card"
            className={cn("overflow-hidden rounded-[1.25rem] bg-paper-raised ring-1 ring-line", i >= 4 && "max-sm:hidden")}
          >
            <div className="aspect-[3/4] w-full animate-pulse bg-paper-sunken motion-reduce:animate-none" />
            <div className="space-y-2 px-3 pt-3 pb-3.5">
              <SkeletonBar className="w-2/3" />
              <SkeletonBar className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * «القوالب»: the catalogue of website templates as a short, first-class
 * section — one search (by name or kind, Arabic spellings folded), one row of
 * kinds with how many each holds, and a grid of portrait cards, two to a row
 * on a phone. Only the first eight show until «اعرض الكل», so the page stays
 * short; a search shows everything it finds. The template the store's site
 * started from leads the grid and wears «الحالي».
 *
 * A card opens the template's sheet (TemplateSheet): the live store, and the
 * one button that uses it.
 */
export function TemplatesGallery({
  currentSite,
  headingHidden = false,
  className,
}: {
  /** The site the store has now, if any: marks its template, and is named in the "use" confirmation. */
  currentSite: Website | null;
  /** First run: the steps above already say "choose a template", so the heading is for screen readers only. */
  headingHidden?: boolean;
  className?: string;
}) {
  const t = useT(STRINGS);
  const codeLabel = useCodeLabel();
  const headingId = useId();
  // The catalogue is public and the same for every store: remembered for the session, refreshed behind.
  // The category and the search narrow it in the browser.
  const templates = useCachedAsync<WebsiteTemplateSummary[]>("website:templates", () => apiClient.listWebsiteTemplates(), []);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [expanded, setExpanded] = useState(false);
  // The picked template stays while its sheet slides away; `sheetOpen` is what closes it.
  const [picked, setPicked] = useState<WebsiteTemplateSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentVersion = currentSite?.sourceTemplateVersionId ?? null;
  const list = useMemo(() => {
    const all: WebsiteTemplateSummary[] = templates.data ?? [];
    if (!currentVersion) return all;
    // The one in use first (the sort is stable: the rest keep the catalogue's order).
    return [...all].sort(
      (a, b) => Number(b.templateVersionId === currentVersion) - Number(a.templateVersionId === currentVersion)
    );
  }, [templates.data, currentVersion]);
  const categories = useMemo(() => templateCategories(list), [list]);

  // By name, or by kind — in the dashboard's language or as the catalogue spells it.
  const needle = normalizeSearch(query);
  const found =
    needle === ""
      ? list
      : list.filter(
          (template) =>
            normalizeSearch(template.name).includes(needle) ||
            (template.category
              ? normalizeSearch(codeLabel("category", template.category)).includes(needle) ||
                normalizeSearch(template.category.replace(/_/g, " ")).includes(needle)
              : false)
        );
  const shown = category === ALL_CATEGORIES ? found : found.filter((template) => template.category === category);
  const canFold = needle === "" && shown.length > FIRST_CARDS;
  const visible = canFold && !expanded ? shown.slice(0, FIRST_CARDS) : shown;

  const chips: ChipItem<string>[] = [
    { value: ALL_CATEGORIES, label: t.all, count: found.length },
    ...categories.map((c) => ({
      value: c,
      label: codeLabel("category", c),
      count: found.filter((template) => template.category === c).length,
    })),
  ];

  function clearFilters() {
    setQuery("");
    setCategory(ALL_CATEGORIES);
  }

  return (
    <section data-slot="templates" aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <div className={cn("mb-3 flex items-baseline justify-between gap-3", headingHidden && "sr-only")}>
        <h2 id={headingId} className="font-display text-lg font-semibold text-ink">
          {t.title}
        </h2>
        {list.length > 0 && <span className="text-[13px] text-ink-soft">{pluralOf(t, "count", list.length)}</span>}
      </div>

      <DataState
        loading={templates.loading}
        error={templates.error}
        empty={list.length === 0}
        emptyMessage={t.noTemplates}
        onRetry={() => void templates.refresh()}
        skeleton={<GallerySkeleton />}
      >
        <div className="flex flex-col gap-3">
          <ListToolbar
            search={{ value: query, onChange: setQuery, placeholder: t.searchPlaceholder, label: t.search }}
          />
          {categories.length > 1 && (
            <ChipRow items={chips} value={category} onChange={setCategory} label={t.filterLabel} />
          )}
        </div>

        {shown.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<IconSearch aria-hidden />}
            title={t.noMatchTitle}
            description={t.noMatchDescription}
            action={
              <Button type="button" variant="outline" className="rounded-full px-5" onClick={clearFilters}>
                {t.clearFilters}
              </Button>
            }
          />
        ) : (
          <>
            <ul className={cn(GRID, "mt-4")}>
              {visible.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  current={currentVersion !== null && template.templateVersionId === currentVersion}
                  onOpen={() => {
                    setPicked(template);
                    setSheetOpen(true);
                  }}
                />
              ))}
            </ul>
            {canFold && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={expanded}
                  className="min-h-11 rounded-full px-5"
                  onClick={() => setExpanded((was) => !was)}
                >
                  {expanded ? t.showLess : fmt(t.showAll, { n: shown.length })}
                </Button>
              </div>
            )}
          </>
        )}
      </DataState>

      {picked && (
        <TemplateSheet
          template={picked}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          currentSite={currentSite}
          inUse={currentVersion !== null && picked.templateVersionId === currentVersion}
        />
      )}
    </section>
  );
}
