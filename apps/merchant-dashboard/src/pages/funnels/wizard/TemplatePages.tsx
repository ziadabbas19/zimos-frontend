import { useEffect, useRef, useState } from "react";
import { cn } from "@store-builder/ui";
import type { PageTree } from "@store-builder/api-client";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { IconDesktop, IconLayout, IconPhoneDevice } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { TemplateLivePreview } from "@/components/TemplateLivePreview";
import { columnTitle, sectionIcon, sectionLabel } from "../../website/editor/blocks";

const STRINGS = {
  en: {
    pagesLabel: "Template pages",
    device: "Preview size",
    desktop: "Computer",
    mobile: "Phone",
    livePreview: "{name} — {page}",
    onThisPage: "On this page",
    emptyPage: "This page is still empty.",
  },
  ar: {
    pagesLabel: "صفحات القالب",
    device: "حجم المعاينة",
    desktop: "الحاسوب",
    mobile: "الهاتف",
    livePreview: "{name} — {page}",
    onThisPage: "في هذه الصفحة",
    emptyPage: "هذه الصفحة ما زالت فارغة.",
  },
} satisfies Messages;

export interface TemplatePageView {
  key: string;
  name: string;
  /** "Landing page", "Checkout"… — empty when the step's kind is not known. */
  typeLabel: string;
  tree: PageTree | null;
}

/**
 * The pages of a template, read before anyone copies it: a row of small
 * pictures to swipe through — one per page, in the funnel's order — and under
 * it the chosen page as the storefront really renders it, at a phone's or a
 * computer's width, with its sections listed so the merchant can read what is
 * on it even when the live render can't load.
 *
 * The small pictures load only as they come into view and take no input; the
 * large one loads at once and scrolls.
 */
export function TemplatePages({
  pages,
  workspaceId,
  previewId,
  templateName,
}: {
  pages: ReadonlyArray<TemplatePageView>;
  workspaceId: string;
  /** Unique per template: the live previews are keyed by it. */
  previewId: string;
  templateName: string;
}) {
  const t = useT(STRINGS);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const stripRef = useRef<HTMLOListElement>(null);
  const page = pages.find((p) => p.key === pageKey) ?? pages[0] ?? null;

  // The chosen picture is brought into the strip by scrolling the strip alone — never the sheet.
  useEffect(() => {
    const strip = stripRef.current;
    const chosen = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !chosen) return;
    const row = strip.getBoundingClientRect();
    const box = chosen.getBoundingClientRect();
    if (box.left >= row.left && box.right <= row.right) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    strip.scrollBy({ left: box.left < row.left ? box.left - row.left - 16 : box.right - row.right + 16, behavior: calm ? "auto" : "smooth" });
  }, [page?.key]);

  if (!page) return <p className="text-sm text-ink-soft">{t.emptyPage}</p>;

  return (
    <div className="space-y-3">
      {pages.length > 1 && (
        <ol
          ref={stripRef}
          aria-label={t.pagesLabel}
          className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-5 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((p, i) => {
            const current = p.key === page.key;
            return (
              <li key={p.key} className="w-[7.5rem] shrink-0 snap-start sm:w-36">
                <div
                  data-slot="template-page"
                  data-active={current ? "" : undefined}
                  className={cn(
                    "zimos-template-page relative overflow-hidden rounded-[1rem]",
                    "transition-[scale,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-safe:has-[button:active]:scale-[0.97] motion-reduce:transition-none",
                    current ? "ring-2 ring-primary" : "ring-1 ring-line"
                  )}
                >
                  <div className="pointer-events-none bg-paper-sunken">
                    <TemplateLivePreview
                      variant="card"
                      aspect="3/4"
                      cardLayout="mobile"
                      workspaceId={workspaceId}
                      templateId={`${previewId}-${p.key}-thumb`}
                      page={p.tree}
                      title={fmt(t.livePreview, { name: templateName, page: p.name })}
                      fallback={
                        <span className="flex size-full items-center justify-center text-ink-soft">
                          <IconLayout className="size-6" aria-hidden />
                        </span>
                      }
                    />
                  </div>
                  <div className="bg-paper-raised px-2.5 py-1.5">
                    {/* The name isolated: a name in the other script would pull the number to its far side. */}
                    <p className="truncate text-xs leading-5 font-medium text-ink">
                      {fmt("{n}", { n: i + 1 })}. <bdi>{p.name}</bdi>
                    </p>
                    {p.typeLabel && <p className="truncate text-[11px] leading-4 text-ink-soft">{p.typeLabel}</p>}
                  </div>
                  {/* The button lies over the picture: the frame under it takes no input. */}
                  <button
                    type="button"
                    aria-current={current ? "true" : undefined}
                    aria-label={fmt(t.livePreview, { name: fmt("{n}", { n: i + 1 }), page: p.name })}
                    onClick={() => setPageKey(p.key)}
                    className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-medium text-ink">
          <bdi dir="auto">{page.name}</bdi>
          {page.typeLabel && <span className="ms-2 text-xs font-normal text-ink-soft">{page.typeLabel}</span>}
        </p>
        <Segmented
          size="sm"
          label={t.device}
          value={device}
          onChange={setDevice}
          options={[
            { value: "mobile", label: t.mobile, icon: IconPhoneDevice },
            { value: "desktop", label: t.desktop, icon: IconDesktop },
          ]}
        />
      </div>

      <div data-slot="template-stage" className="zimos-template-stage h-[min(58dvh,32rem)] overflow-hidden rounded-[1.25rem] bg-paper-sunken ring-1 ring-line">
        <TemplateLivePreview
          key={page.key}
          variant="full"
          device={device}
          workspaceId={workspaceId}
          templateId={`${previewId}-${page.key}`}
          page={page.tree}
          title={fmt(t.livePreview, { name: templateName, page: page.name })}
          fallback={
            <div className="flex h-full items-center justify-center text-ink-soft">
              <IconLayout className="size-8" aria-hidden />
            </div>
          }
        />
      </div>

      <PageOutline tree={page.tree} />
    </div>
  );
}

/** The page's sections in order — what each one is and the first words it says. */
function PageOutline({ tree }: { tree: PageTree | null }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const sections = tree?.sections ?? [];
  if (sections.length === 0) return <p className="text-sm text-ink-soft">{t.emptyPage}</p>;
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">{t.onThisPage}</h3>
      <ol className="mt-2 space-y-1.5">
        {sections.map((section, i) => {
          const Icon = sectionIcon(section);
          const words = (section.rows ?? [])
            .flatMap((row) => row.columns ?? [])
            .map((column) => columnTitle(column, 80))
            .find(Boolean);
          return (
            <li key={section.id ?? i} className="zimos-funnel-note flex items-start gap-2.5 rounded-[0.875rem] bg-paper-sunken/70 px-3 py-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{sectionLabel(section, locale)}</span>
                {words && (
                  <span className="block truncate text-xs text-ink-soft" dir="auto">
                    {words}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
