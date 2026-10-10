import { useState } from "react";
import { IconSuccess, IconWarning } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import { funnelExtrasIssues, type FunnelIssue } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Sheet } from "@/components/Sheet";

/**
 * What the server finds in the funnel's SAVED version (SPEC §9.2 "Quality"):
 * fatal issues are the ones that block publishing, warnings are advice. The
 * list is the server's (GET /funnels/:id/issues), re-read whenever `version`
 * changes (the editor passes its save counter) and when its surface opens.
 *
 * Three pieces, so the editor's bar can show it inside its own "before you
 * publish" surface while the count and the fetch stay here:
 *  - `useFunnelIssues`   the fetch, the counts and the wording of an issue;
 *  - `FunnelIssuesList`  the list itself;
 *  - `FunnelIssuesButton` the two on their own: a counter that opens a sheet.
 */

const STRINGS = {
  en: {
    none: "No issues",
    count: "Issues",
    title: "Things to fix",
    description: "Problems marked \"blocks publishing\" must be fixed first. The rest are advice.",
    fatal: "Blocks publishing",
    warning: "Advice",
    page: "Page",
    allGood: "Nothing to fix — this funnel is ready.",
    close: "Close",
    showStep: "Show step",
    checking: "Checking the saved version…",
    failed: "We couldn't check the saved version just now.",
    noAccess: "Your role can't read the server's check.",
    retry: "Try again",
    page_without_product: "This page sells nothing yet: add a product to it.",
    unlinked_button: "A button on this page goes nowhere.",
    image_without_alt: "An image on this page has no description.",
    missing_policies: "Your store has no policies yet (Store settings → Policies). Ad platforms ask for them.",
    untranslated_text: "{n} texts on this page are not translated into {language} yet (Store settings → Languages).",
  },
  ar: {
    none: "لا توجد مشاكل",
    count: "مشاكل",
    title: "أشياء تحتاج إصلاحًا",
    description: "المشاكل المعلَّمة «تمنع النشر» يجب إصلاحها أولًا. الباقي نصائح.",
    fatal: "تمنع النشر",
    warning: "نصيحة",
    page: "الصفحة",
    allGood: "لا يوجد ما يحتاج إصلاحًا — المسار جاهز.",
    close: "إغلاق",
    showStep: "انتقل إلى الخطوة",
    checking: "جارٍ مراجعة النسخة المحفوظة…",
    failed: "تعذّرت مراجعة النسخة المحفوظة الآن.",
    noAccess: "صلاحياتك لا تتيح عرض مراجعة الخادم.",
    retry: "إعادة المحاولة",
    page_without_product: "هذه الصفحة لا تبيع شيئًا بعد: أضف منتجًا إليها.",
    unlinked_button: "زرار في هذه الصفحة لا يؤدي لأي مكان.",
    image_without_alt: "صورة في هذه الصفحة بدون وصف.",
    missing_policies: "متجرك بدون سياسات حتى الآن (إعدادات المتجر ← السياسات). منصات الإعلانات تطلبها.",
    untranslated_text: "{n} نص في الصفحة دي لسه مش مترجم لـ{language} (إعدادات المتجر ← اللغات).",
  },
} satisfies Messages;

/** A language's name in the dashboard's language ("English", "الفرنسية"). */
function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface FunnelIssuesState {
  issues: FunnelIssue[];
  counts: { fatal: number; warning: number };
  /** Fatal and advice together. */
  total: number;
  /** True only before the first answer; a re-read keeps the old list on screen. */
  loading: boolean;
  /** Set when the last read failed (a 403 included). */
  error: unknown;
  /** Read again, quietly. */
  refresh: () => void;
  /** The sentence of one issue, in the dashboard's language. */
  text: (issue: FunnelIssue) => string;
}

/** The server's issues for one funnel: its own fetch and its own count. */
export function useFunnelIssues(funnelId: string, version = 0): FunnelIssuesState {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const state = useAsync(() => funnelExtrasIssues(apiClient, workspaceId, funnelId), [workspaceId, funnelId, version]);
  const counts = state.data?.counts ?? { fatal: 0, warning: 0 };

  // Graph problems come as the server's own sentence; the content checks are translated by code.
  const text = (issue: FunnelIssue) =>
    issue.code === "graph"
      ? issue.message
      : issue.code === "untranslated_text"
        ? fmt(t.untranslated_text, { n: issue.count ?? 0, language: languageName(issue.locale ?? "", locale) })
        : ((t as Record<string, string>)[issue.code] ?? issue.message);

  return {
    issues: state.data?.issues ?? [],
    counts,
    total: counts.fatal + counts.warning,
    loading: state.loading && !state.data,
    error: state.data ? null : state.error,
    refresh: () => void state.refresh({ silent: true }),
    text,
  };
}

/**
 * The issues as a list: each with whether it blocks publishing, the page it is
 * on and — when the caller can jump there — «ورّيني الخطوة». While it loads,
 * or when the read failed or is not allowed, it says so in one quiet line in
 * place; an empty list says the saved version is fine.
 */
export function FunnelIssuesList({
  state,
  stepNames = {},
  onShowStep,
  className,
}: {
  state: FunnelIssuesState;
  /** Step key → the name the merchant gave the page. */
  stepNames?: Record<string, string>;
  /** Jump to the step an issue names. Without it the list is read-only. */
  onShowStep?: (stepKey: string) => void;
  className?: string;
}) {
  const t = useT(STRINGS);

  if (state.loading) return <p className={cn("text-sm text-ink-soft", className)}>{t.checking}</p>;
  if (state.error) {
    const denied = isPermissionError(state.error);
    return (
      <div className={cn("flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft", className)}>
        <span>{denied ? t.noAccess : t.failed}</span>
        {!denied && (
          <Button type="button" size="sm" variant="outline" className="h-9 rounded-full px-3 pointer-coarse:h-11" onClick={state.refresh}>
            {t.retry}
          </Button>
        )}
      </div>
    );
  }
  if (state.total === 0) {
    return (
      <p className={cn("flex items-center gap-1.5 text-sm text-ink-soft", className)}>
        <IconSuccess className="size-4 shrink-0 text-success" aria-hidden />
        {t.allGood}
      </p>
    );
  }
  return (
    <ul className={cn("space-y-2", className)}>
      {state.issues.map((issue, i) => {
        const stepKey = issue.stepKey ?? null;
        // Only a step the editor still has can be shown.
        const canShow = Boolean(onShowStep && stepKey && stepKey in stepNames);
        return (
          <li key={i} data-slot="funnel-issue" data-severity={issue.severity} className="rounded-[0.875rem] bg-paper p-3 ring-1 ring-line">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <p className={cn("min-w-0 text-xs font-semibold", issue.severity === "fatal" ? "text-danger" : "text-ink-soft")}>
                {issue.severity === "fatal" ? t.fatal : t.warning}
                {stepKey && (
                  <span className="ms-2 font-normal text-ink-soft" dir="auto">
                    {t.page}: {stepNames[stepKey] ?? stepKey}
                  </span>
                )}
              </p>
              {canShow && stepKey && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 rounded-full px-3 pointer-coarse:h-11"
                  onClick={() => onShowStep?.(stepKey)}
                >
                  {t.showStep}
                </Button>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-ink" dir="auto">
              {state.text(issue)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** The counter on its own: a button that says how many issues there are and opens the list in a sheet. */
export function FunnelIssuesButton({
  funnelId,
  version = 0,
  stepNames = {},
}: {
  funnelId: string;
  /** Bump to re-read the issues (e.g. after a save). */
  version?: number;
  /** Step key → the name the merchant gave the page. */
  stepNames?: Record<string, string>;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  const state = useFunnelIssues(funnelId, version);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={state.loading}
        onClick={() => {
          setOpen(true);
          state.refresh();
        }}
        className={cn("h-9 rounded-full px-3 pointer-coarse:h-11", state.counts.fatal > 0 && "border-danger/50 text-danger")}
      >
        {state.total === 0 ? <IconSuccess className="size-4 text-success" aria-hidden /> : <IconWarning className="size-4" aria-hidden />}
        {state.total === 0 ? t.none : fmt("{label} ({n})", { label: t.count, n: state.total })}
      </Button>

      <Sheet open={open} onOpenChange={setOpen} title={t.title} description={t.description} size="md">
        <FunnelIssuesList state={state} stepNames={stepNames} />
      </Sheet>
    </>
  );
}
