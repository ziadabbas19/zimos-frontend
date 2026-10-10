import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import { funnelsList } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import { IconEye, IconFunnels } from "@/components/icons";
import { DataState } from "@/components/DataState";
import { ChipRow, ListSkeleton } from "@/components/list";
import { Segmented } from "@/components/Segmented";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { STARTER_TEMPLATE_IDS, starterPlan, type StarterTemplateId, type UiStepType } from "./funnelAdapter";
import { STARTER_TEMPLATE_TEXT, STATUS_LABELS, STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import { StepChain } from "./StepChain";
import { ChoiceCard } from "./wizard/ChoiceCard";
import { TemplatePages } from "./wizard/TemplatePages";

/**
 * The funnel wizard's template gallery, the answer to "which look?": the ready
 * funnels — each in an Arabic and an English version, each with its steps as a
 * chain and a preview of its pages — and in "My funnels" any funnel of this
 * store to start a new one from (a copy of its pages and links).
 */

const STRINGS = {
  en: {
    tabs: "Where the template comes from",
    all: "Ready",
    mine: "My funnels",
    filter: "Kind",
    any: "All",
    cod: "Cash on delivery",
    upsell: "With an offer after the order",
    leads: "Leads",
    advertorial: "Advertorial",
    language: "Version",
    arabic: "Arabic",
    english: "English",
    templates: "Ready funnels",
    preview: "Preview",
    previewOf: "Preview “{name}”",
    close: "Close",
    chooseThis: "Choose this one",
    updated: "Edited {date}",
    myFunnels: "Your funnels",
    noneMine: "No funnels yet. Your own funnels show up here to start new ones from.",
    noneFit: "No ready funnel of this kind.",
    copyHint: "A copy of its pages and links, with the same products and offers.",
  },
  ar: {
    tabs: "مصدر القالب",
    all: "جاهزة",
    mine: "مساراتي",
    filter: "النوع",
    any: "الكل",
    cod: "دفع عند الاستلام",
    upsell: "مع عرض بعد الشراء",
    leads: "جمع عملاء",
    advertorial: "مقال إعلاني",
    language: "النسخة",
    arabic: "عربي",
    english: "English",
    templates: "مسارات بيع جاهزة",
    preview: "معاينة",
    previewOf: "معاينة «{name}»",
    close: "إغلاق",
    chooseThis: "اختيار هذا",
    updated: "عُدّل {date}",
    myFunnels: "مسارات البيع لديك",
    noneMine: "لا توجد مسارات بيع بعد. تظهر مساراتك هنا لتبدأ منها مسارًا جديدًا.",
    noneFit: "لا يوجد مسار بيع جاهز من هذا النوع.",
    copyHint: "نسخة من صفحاته وروابطه، بالمنتجات والعروض نفسها.",
  },
} satisfies Messages;

type Kind = "any" | "cod" | "upsell" | "leads" | "advertorial";
const KINDS: readonly Kind[] = ["any", "cod", "upsell", "leads", "advertorial"];
const KIND_TEST: Record<Exclude<Kind, "any">, (types: UiStepType[]) => boolean> = {
  cod: (types) => types.includes("checkout"),
  upsell: (types) => types.includes("upsell") || types.includes("downsell"),
  leads: (types) => types.includes("opt_in"),
  advertorial: (types) => types.includes("article"),
};

type Tab = "all" | "mine";

export type GalleryPick =
  | { kind: "starter"; id: StarterTemplateId; lang: Locale }
  | { kind: "copy"; funnelId: string; name: string };

/** The ready funnel the wizard starts on for an answer to "an offer after the order?". */
export function defaultStarter(goal: "sell" | "leads", upsell: boolean): StarterTemplateId {
  return goal === "leads" ? "lead-magnet" : upsell ? "cod-upsell" : "cod-single";
}

/**
 * Whether a ready funnel is one of the choices for these answers: it suits the
 * goal (an order form to sell, a sign-up form for leads; the blank one suits
 * selling only by its steps) and, when the wizard asked about an offer after
 * the order, it has an offer step exactly when the answer was yes.
 */
export function starterFits(types: UiStepType[], id: StarterTemplateId, goal: "sell" | "leads", upsell: boolean | undefined): boolean {
  if (id !== "blank" && !(goal === "leads" ? KIND_TEST.leads(types) : KIND_TEST.cod(types))) return false;
  if (upsell === undefined || goal === "leads") return true;
  return KIND_TEST.upsell(types) === upsell;
}

/** The same, for a ready funnel named by its id. */
export function isStarterFor(id: StarterTemplateId, goal: "sell" | "leads", upsell: boolean, locale: Locale): boolean {
  return starterFits(starterPlan(id, locale).steps.map((s) => s.type), id, goal, upsell);
}

const PREVIEW_PILL =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary " +
  "transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none";

export function FunnelTemplateGallery({
  goal,
  value,
  onChange,
  locale,
  leading,
  upsell,
}: {
  goal: "sell" | "leads";
  value: GalleryPick | null;
  onChange: (pick: GalleryPick) => void;
  locale: Locale;
  /** Cards that always come first (the AI template). */
  leading?: ReactNode;
  /**
   * The wizard's answer to "an offer after the order?". Given, the ready
   * funnels are the ones that match it and the kind chips are not drawn (the
   * switch on the question before decides). Left out: every ready funnel for
   * the goal, with the kind chips to narrow them, as before.
   */
  upsell?: boolean;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [tab, setTab] = useState<Tab>("all");
  const [kind, setKind] = useState<Kind>("any");
  const [lang, setLang] = useState<Locale>(value?.kind === "starter" ? value.lang : locale);
  const [preview, setPreview] = useState<StarterTemplateId | null>(null);
  const mine = useAsync(() => (tab === "mine" ? funnelsList(apiClient, workspaceId) : Promise.resolve(null)), [workspaceId, tab]);

  const templates = useMemo(
    () =>
      STARTER_TEMPLATE_IDS.map((id) => ({ id, ...STARTER_TEMPLATE_TEXT[lang][id], plan: starterPlan(id, lang) })).filter((tpl) => {
        const types = tpl.plan.steps.map((s) => s.type);
        if (!starterFits(types, tpl.id, goal, upsell)) return false;
        if (upsell !== undefined) return true;
        return kind === "any" || tpl.id === "blank" || KIND_TEST[kind](types);
      }),
    [goal, kind, lang, upsell]
  );
  // The preview reads the plan itself, so a template filtered out since it was opened still shows.
  const previewed = useMemo(() => (preview ? { id: preview, ...STARTER_TEMPLATE_TEXT[lang][preview], plan: starterPlan(preview, lang) } : null), [preview, lang]);

  function changeLang(next: Locale) {
    setLang(next);
    // The chosen ready funnel follows the version: the same funnel, in the other language.
    if (value?.kind === "starter") onChange({ kind: "starter", id: value.id, lang: next });
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Segmented
        label={t.tabs}
        value={tab}
        onChange={setTab}
        className="w-full"
        options={[
          { value: "all", label: t.all },
          { value: "mine", label: t.mine },
        ]}
      />

      {tab === "all" ? (
        <>
          {upsell === undefined && (
            <ChipRow label={t.filter} value={kind} onChange={setKind} collapseEmpty={false} items={KINDS.map((k) => ({ value: k, label: t[k] }))} />
          )}
          <div className="flex justify-end">
            <Segmented
              size="sm"
              label={t.language}
              value={lang}
              onChange={changeLang}
              options={[
                { value: "ar", label: t.arabic },
                { value: "en", label: t.english },
              ]}
            />
          </div>
          <div role="radiogroup" aria-label={t.templates} className="grid gap-2 sm:grid-cols-2">
            {leading}
            {templates.length === 0 && <p className="px-1 py-3 text-sm text-ink-soft">{t.noneFit}</p>}
            {templates.map((tpl) => {
              const active = value?.kind === "starter" && value.id === tpl.id;
              return (
                <ChoiceCard
                  key={tpl.id}
                  name="funnel-template"
                  checked={active}
                  onSelect={() => onChange({ kind: "starter", id: tpl.id, lang })}
                  title={tpl.name}
                  hint={<span dir="auto">{tpl.description}</span>}
                >
                  <StepChain types={tpl.plan.steps.map((s) => s.type)} className="mt-2" />
                  <div className="-mb-1.5 flex justify-end">
                    <button type="button" className={PREVIEW_PILL} onClick={() => setPreview(tpl.id)} aria-label={fmt(t.previewOf, { name: tpl.name })}>
                      <IconEye className="size-4" aria-hidden /> {t.preview}
                    </button>
                  </div>
                </ChoiceCard>
              );
            })}
          </div>
        </>
      ) : (
        <DataState
          loading={mine.loading}
          error={mine.error}
          empty={(mine.data ?? []).length === 0}
          emptyMessage={t.noneMine}
          onRetry={() => void mine.refresh()}
          skeleton={<ListSkeleton variant="card" rows={3} />}
        >
          <p className="px-1 text-xs leading-5 text-ink-soft">{t.copyHint}</p>
          <div role="radiogroup" aria-label={t.myFunnels} className="mt-2 grid gap-2 sm:grid-cols-2">
            {[...(mine.data ?? [])]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((f) => (
                <ChoiceCard
                  key={f.id}
                  name="funnel-template"
                  checked={value?.kind === "copy" && value.funnelId === f.id}
                  onSelect={() => onChange({ kind: "copy", funnelId: f.id, name: f.name })}
                  leading={
                    <span className="flex size-11 items-center justify-center rounded-[0.875rem] bg-paper-sunken text-ink-soft">
                      <IconFunnels className="size-5" aria-hidden />
                    </span>
                  }
                  title={f.name}
                  hint={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusBadge value={f.status} text={STATUS_LABELS[locale][f.status]} tone={f.status === "published" ? "success" : f.status === "paused" ? "warning" : "neutral"} />
                      <span>{fmt(t.updated, { date: formatDate(f.updatedAt) })}</span>
                    </span>
                  }
                />
              ))}
          </div>
        </DataState>
      )}

      <Sheet
        open={previewed !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={previewed?.name ?? t.preview}
        description={previewed?.description}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreview(null)}>
              {t.close}
            </Button>
            {previewed && (
              <Button
                onClick={() => {
                  onChange({ kind: "starter", id: previewed.id, lang });
                  setPreview(null);
                }}
              >
                {t.chooseThis}
              </Button>
            )}
          </>
        }
      >
        {previewed && (
          <div className="space-y-4">
            <StepChain types={previewed.plan.steps.map((s) => s.type)} />
            <TemplatePages
              key={`${previewed.id}-${lang}`}
              workspaceId={workspaceId}
              previewId={`starter-${previewed.id}-${lang}`}
              templateName={previewed.name}
              pages={previewed.plan.steps.map((s) => ({ key: s.key, name: s.name, typeLabel: STEP_TYPE_LABELS[lang][s.type], tree: s.tree }))}
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}
