import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Check, ListChecks, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Alert, Button, Card, Input, cn } from "@store-builder/ui";
import {
  automationFlowsDelete,
  automationFlowsEnableTemplate,
  automationFlowsList,
  automationFlowsListRuns,
  automationFlowsListTemplates,
  automationFlowsUpdate,
  type AutomationFlowRule,
  type AutomationFlowRun,
  type AutomationFlowRunStatus,
  type AutomationFlowTemplate,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { ApiError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { AUTOMATION_STRINGS, stepSummary, stepTypeLabel, triggerLabel } from "./automationText";
import { RuleEditorDialog } from "./RuleEditorDialog";

/**
 * Automations (SPEC §14.2): rules that run an ordered sequence of steps when
 * something happens to an order — messages, waits, a webhook, a tag, a status
 * change, a note to the team. Ready-made templates switch on with one click;
 * every step of every run is in the log below.
 */

const STRINGS = {
  en: {
    title: "Automations",
    description: "Run a sequence of steps by itself when something happens to an order: messages, waits, tags, status changes.",
    newRule: "New automation",
    notConnected: "WhatsApp isn't connected, so WhatsApp steps will fail until it is.",
    connect: "Connect WhatsApp",
    templatesTitle: "Ready-made automations",
    templatesDesc: "Switch one on with a click, then adjust it like any other automation.",
    enable: "Switch on",
    enabled: "Switched on",
    planLocked: "Not in your current plan",
    seePlans: "See the plans",
    viewMessages: "Messages to approve",
    messagesTitle: "WhatsApp templates for “{name}”",
    messagesDesc:
      "WhatsApp only sends templates approved in your own Meta account. Create each of these there under exactly this name; until Meta approves it, that step fails and says so in the log.",
    templateName: "Template name",
    buttons: "Quick-reply buttons",
    close: "Close",
    templateEnabled: "“{name}” is on. Review its steps below.",
    templateCoupon: "Coupon for the last reminder (optional)",
    rulesTitle: "Your automations",
    noRules: "No automations yet",
    noRulesDesc: "Switch on a ready-made one above, or build your own sequence.",
    active: "Active",
    whenTrigger: "When",
    stats: "{sent} done · {skipped} skipped · {failed} failed",
    lastRun: "Last run {date}",
    never: "Never ran",
    edit: "Edit",
    delete: "Delete",
    saved: "Automation saved.",
    created: "Automation created.",
    deleteTitle: "Delete this automation?",
    deleteDesc: "“{name}” will stop running. Sequences that are waiting stop too. Its past runs stay in the log.",
    deleting: "Deleting…",
    cancel: "Cancel",
    deleted: "Automation deleted.",
    runsTitle: "Run log",
    filter: "Filter runs by result",
    allRules: "All automations",
    all: "All",
    sent: "Done",
    skipped: "Skipped",
    failed: "Failed",
    noRuns: "Nothing has run yet",
    noRunsDesc: "Each step an automation runs, skips or fails on shows up here.",
    colTime: "Time",
    colRule: "Automation",
    colStep: "Step",
    colOrder: "Order",
    colStatus: "Result",
    colDetail: "Detail",
    deletedRule: "Deleted automation",
    wholeRule: "Whole automation",
  },
  ar: {
    title: "الأتمتة",
    description: "نفّذ سلسلة خطوات تلقائيًا عندما يحدث شيء للطلب: رسائل، انتظار، وسوم، تغيير حالة.",
    newRule: "أتمتة جديدة",
    notConnected: "واتساب غير مربوط، لذلك ستفشل خطوات واتساب حتى يتم ربطه.",
    connect: "ربط واتساب",
    templatesTitle: "أتمتة جاهزة",
    templatesDesc: "فعّل أيًّا منها بضغطة، ثم عدّلها مثل أي أتمتة أخرى.",
    enable: "تفعيل",
    enabled: "مفعّلة",
    planLocked: "غير متاحة في خطتك الحالية",
    seePlans: "عرض الخطط",
    viewMessages: "الرسائل المطلوب اعتمادها",
    messagesTitle: "قوالب واتساب لـ «{name}»",
    messagesDesc:
      "واتساب يرسل فقط القوالب المعتمدة في حسابك على Meta. أنشئ كل قالب هناك بنفس الاسم تمامًا؛ وحتى تعتمده Meta ستفشل هذه الخطوة ويظهر السبب في السجل.",
    templateName: "اسم القالب",
    buttons: "أزرار الرد السريع",
    close: "إغلاق",
    templateEnabled: "تم تفعيل «{name}». راجع خطواتها بالأسفل.",
    templateCoupon: "كود خصم للتذكير الأخير (اختياري)",
    rulesTitle: "الأتمتة الخاصة بك",
    noRules: "لا توجد أتمتة بعد",
    noRulesDesc: "فعّل واحدة جاهزة من الأعلى، أو ابنِ سلسلتك الخاصة.",
    active: "مفعّلة",
    whenTrigger: "عند",
    stats: "{sent} تمت · {skipped} تخطّت · {failed} فشلت",
    lastRun: "آخر تشغيل {date}",
    never: "لم تعمل بعد",
    edit: "تعديل",
    delete: "حذف",
    saved: "تم حفظ الأتمتة.",
    created: "تم إنشاء الأتمتة.",
    deleteTitle: "حذف هذه الأتمتة؟",
    deleteDesc: "ستتوقف «{name}» عن العمل، وتتوقف السلاسل المنتظرة أيضًا. سجل تشغيلها السابق يبقى.",
    deleting: "جارٍ الحذف…",
    cancel: "إلغاء",
    deleted: "تم حذف الأتمتة.",
    runsTitle: "سجل التشغيل",
    filter: "تصفية السجل حسب النتيجة",
    allRules: "كل الأتمتة",
    all: "الكل",
    sent: "تمت",
    skipped: "تخطّت",
    failed: "فشلت",
    noRuns: "لم يعمل شيء بعد",
    noRunsDesc: "كل خطوة تنفّذها الأتمتة أو تتخطاها أو تفشل فيها تظهر هنا.",
    colTime: "الوقت",
    colRule: "الأتمتة",
    colStep: "الخطوة",
    colOrder: "الطلب",
    colStatus: "النتيجة",
    colDetail: "التفاصيل",
    deletedRule: "أتمتة محذوفة",
    wholeRule: "الأتمتة كلها",
  },
} satisfies Messages;

const RUN_TONE = { sent: "success", skipped: "neutral", failed: "danger" } as const;
const RUNS_PAGE = 50;
type RunFilter = "all" | AutomationFlowRunStatus;

export function AutomationsPage() {
  const t = useT(STRINGS);
  const at = useT(AUTOMATION_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const integration = useAsync(() => apiClient.getWhatsappIntegration(workspaceId), [workspaceId]);
  const rules = useAsync(() => automationFlowsList(apiClient, workspaceId), [workspaceId]);
  const templates = useAsync(() => automationFlowsListTemplates(apiClient, workspaceId), [workspaceId]);

  const [editing, setEditing] = useState<AutomationFlowRule | "new" | null>(null);
  const [toDelete, setToDelete] = useState<AutomationFlowRule | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [enabling, setEnabling] = useState<string | null>(null);
  const [messagesOf, setMessagesOf] = useState<AutomationFlowTemplate | null>(null);

  // --- run log (own paging + filters) ---
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [runRule, setRunRule] = useState("");
  const [runs, setRuns] = useState<AutomationFlowRun[]>([]);
  const [runsCursor, setRunsCursor] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsMore, setRunsMore] = useState(false);
  const [runsError, setRunsError] = useState<unknown>(null);
  const runsCall = useRef(0);

  const loadRuns = useCallback(
    async (before: string | null, silent = false) => {
      const id = ++runsCall.current;
      if (before) setRunsMore(true);
      else if (!silent) setRunsLoading(true);
      setRunsError(null);
      try {
        const page = await automationFlowsListRuns(apiClient, workspaceId, {
          limit: RUNS_PAGE,
          before,
          status: runFilter === "all" ? undefined : runFilter,
          ruleId: runRule || undefined,
        });
        if (id !== runsCall.current) return;
        setRuns((prev) => (before ? [...prev, ...page.runs] : page.runs));
        setRunsCursor(page.nextCursor);
      } catch (err) {
        if (id === runsCall.current) setRunsError(err);
      } finally {
        if (id === runsCall.current) {
          setRunsLoading(false);
          setRunsMore(false);
        }
      }
    },
    [workspaceId, runFilter, runRule]
  );

  useEffect(() => {
    void loadRuns(null);
  }, [loadRuns]);

  const list = rules.data?.rules ?? [];
  const ruleNames = new Map(list.map((r) => [r.id, r.name]));

  async function toggle(rule: AutomationFlowRule, next: boolean) {
    setToggling(rule.id);
    try {
      await automationFlowsUpdate(apiClient, workspaceId, rule.id, { isActive: next });
      await rules.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setToggling(null);
    }
  }

  // The coupon a template that offers one gives in its last message (abandoned cart).
  const [templateCoupons, setTemplateCoupons] = useState<Record<string, string>>({});

  async function enableTemplate(template: AutomationFlowTemplate) {
    setEnabling(template.key);
    try {
      const couponCode = template.acceptsCoupon ? (templateCoupons[template.key] ?? "").trim() : "";
      await automationFlowsEnableTemplate(apiClient, workspaceId, template.key, locale === "en" ? "en" : "ar", couponCode ? { couponCode } : {});
      toast.success(fmt(t.templateEnabled, { name: template.name[locale === "en" ? "en" : "ar"] }));
      await Promise.all([rules.refresh({ silent: true }), templates.refresh({ silent: true })]);
      if (template.whatsappTemplates.length > 0) setMessagesOf(template);
    } catch (err) {
      // The message names the feature the plan lacks; the card then shows itself locked.
      toast.error(errorMessage(err));
      if (err instanceof ApiError && err.code === "PLAN_FEATURE_REQUIRED") void templates.refresh({ silent: true });
    } finally {
      setEnabling(null);
    }
  }

  const lang = locale === "en" ? "en" : "ar";

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setEditing("new")} disabled={!rules.data}>
            <Plus className="size-4" />
            {t.newRule}
          </Button>
        }
      />

      {integration.data && !integration.data.connected && (
        <Alert variant="default" className="mb-6 border-accent/40 bg-accent-soft text-accent-dark dark:text-accent">
          <p>
            {t.notConnected}{" "}
            <Link to="/settings#whatsapp" className="font-medium underline">
              {t.connect}
            </Link>
          </p>
        </Alert>
      )}

      <Section title={t.templatesTitle} description={t.templatesDesc} className="mb-8">
        <DataState loading={templates.loading && !templates.data} error={templates.error} onRetry={() => templates.refresh()}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(templates.data ?? []).map((template) => (
              <div key={template.key} className="flex flex-col rounded-[0.5rem] border border-line p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink">{template.name[lang]}</h3>
                    <p className="mt-0.5 text-xs text-ink-soft">{template.description[lang]}</p>
                  </div>
                </div>
                {template.acceptsCoupon && !template.ruleId && (
                  <Input
                    className="mt-3 h-8 text-xs"
                    dir="ltr"
                    maxLength={100}
                    aria-label={t.templateCoupon}
                    placeholder={t.templateCoupon}
                    value={templateCoupons[template.key] ?? ""}
                    onChange={(e) => setTemplateCoupons((prev) => ({ ...prev, [template.key]: e.target.value }))}
                  />
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                  {template.whatsappTemplates.length > 0 ? (
                    <button type="button" onClick={() => setMessagesOf(template)} className="cursor-pointer text-xs text-primary hover:underline">
                      {t.viewMessages}
                    </button>
                  ) : (
                    <span />
                  )}
                  {template.ruleId ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <Check className="size-4" aria-hidden />
                      {t.enabled}
                    </span>
                  ) : template.planLocked ? (
                    // The plan gate (WHATSAPP_REQUIRE_PLAN_FEATURE): switching it on would be refused.
                    <span className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      {t.planLocked}
                      <Link to="/subscription" className="font-medium text-primary hover:underline">
                        {t.seePlans}
                      </Link>
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" disabled={enabling === template.key} onClick={() => void enableTemplate(template)}>
                      {t.enable}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DataState>
      </Section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t.rulesTitle}</h2>
        <DataState loading={rules.loading && !rules.data} error={rules.error} onRetry={() => rules.refresh()}>
          {list.length === 0 ? (
            <EmptyState icon={<Bot />} title={t.noRules} description={t.noRulesDesc} action={<Button onClick={() => setEditing("new")}>{t.newRule}</Button>} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((rule) => (
                <Card key={rule.id} className="gap-0 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-ink" dir="auto">
                        {rule.name}
                      </h3>
                      <p className="text-sm text-ink-soft">
                        {t.whenTrigger}: {triggerLabel(at, rule.trigger)}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.isActive}
                      aria-label={`${t.active}: ${rule.name}`}
                      disabled={toggling === rule.id}
                      onClick={() => void toggle(rule, !rule.isActive)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        rule.isActive ? "border-primary bg-primary" : "border-line-strong bg-paper"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-4.5 rounded-full bg-paper-raised shadow-sm transition-[inset-inline-start]",
                          rule.isActive ? "start-[1.375rem]" : "start-0.5"
                        )}
                      />
                    </button>
                  </div>

                  <ol className="mt-3 space-y-1.5">
                    {rule.actions.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-medium text-ink-soft" aria-hidden>
                          {i + 1}
                        </span>
                        <span className={cn("min-w-0 break-words", step.type === "wait" ? "text-ink-soft" : "text-ink")} dir="auto">
                          {stepSummary(at, step)}
                        </span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-xs text-ink-soft">
                      {fmt(t.stats, { sent: rule.stats.sent, skipped: rule.stats.skipped, failed: rule.stats.failed })}
                      {" · "}
                      {rule.stats.lastRunAt ? fmt(t.lastRun, { date: formatDateTime(rule.stats.lastRunAt) }) : t.never}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(rule)}>
                        <Pencil className="size-4" />
                        {t.edit}
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => setToDelete(rule)} aria-label={`${t.delete} ${rule.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </DataState>
      </section>

      <Section
        title={t.runsTitle}
        flush
        actions={
          <Select aria-label={t.colRule} value={runRule} onChange={(e) => setRunRule(e.target.value)} className="h-9 max-w-52">
            <option value="">{t.allRules}</option>
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        }
      >
        <div className="px-4 pb-3">
          <FilterTabs
            label={t.filter}
            value={runFilter}
            onChange={setRunFilter}
            tabs={[
              { value: "all", label: t.all },
              { value: "sent", label: t.sent },
              { value: "skipped", label: t.skipped },
              { value: "failed", label: t.failed },
            ]}
          />
        </div>
        <DataState skeleton={<ListSkeleton rows={4} />} loading={runsLoading} error={runsError} onRetry={() => void loadRuns(null)}>
          {runs.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState icon={<ListChecks aria-hidden />} title={t.noRuns} description={t.noRunsDesc} />
            </div>
          ) : (
            <DataTable
              rows={runs}
              rowKey={(run) => run.id}
              minWidth="50rem"
              columns={[
                { key: "time", header: t.colTime, cell: (run) => <span className="text-ink-soft">{formatDateTime(run.createdAt)}</span> },
                {
                  key: "rule",
                  header: t.colRule,
                  cell: (run) => (
                    <span className="text-ink" dir="auto">
                      {(run.ruleId && ruleNames.get(run.ruleId)) ?? t.deletedRule}
                    </span>
                  ),
                },
                {
                  key: "step",
                  header: t.colStep,
                  cell: (run) => (
                    <span className="text-ink-soft">
                      {run.stepType ? `${run.stepIndex !== null ? `${run.stepIndex + 1}. ` : ""}${stepTypeLabel(at, run.stepType)}` : t.wholeRule}
                    </span>
                  ),
                },
                {
                  key: "order",
                  header: t.colOrder,
                  cell: (run) =>
                    run.order ? (
                      <Link to={`/orders/${run.order.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                        <bdi dir="ltr">{run.order.orderNumber ?? "—"}</bdi>
                      </Link>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "status",
                  header: t.colStatus,
                  cell: (run) => <StatusBadge value={run.status} tone={RUN_TONE[run.status]} text={t[run.status]} />,
                },
                {
                  key: "detail",
                  header: t.colDetail,
                  cell: (run) => (
                    <span className={cn(run.status === "failed" ? "text-danger" : "text-ink-soft")} dir="auto">
                      {run.detail ?? "—"}
                    </span>
                  ),
                },
              ]}
            />
          )}
          <div className="pb-4">
            <LoadMore hasMore={Boolean(runsCursor)} loading={runsMore} onClick={() => void loadRuns(runsCursor)} />
          </div>
        </DataState>
      </Section>

      {editing && rules.data && (
        <RuleEditorDialog
          key={editing === "new" ? "new" : editing.id}
          rule={editing === "new" ? null : editing}
          triggers={rules.data.triggers}
          tokens={rules.data.tokens}
          stepTypes={rules.data.stepTypes}
          onClose={() => setEditing(null)}
          onSaved={(_, created) => {
            setEditing(null);
            toast.success(created ? t.created : t.saved);
            void rules.refresh({ silent: true });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t.deleteTitle}
        description={toDelete ? fmt(t.deleteDesc, { name: toDelete.name }) : undefined}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await automationFlowsDelete(apiClient, workspaceId, toDelete.id);
          setToDelete(null);
          toast.success(t.deleted);
          await Promise.all([rules.refresh({ silent: true }), templates.refresh({ silent: true })]);
          void loadRuns(null, true);
        }}
      />

      <Modal
        open={Boolean(messagesOf)}
        onClose={() => setMessagesOf(null)}
        title={messagesOf ? fmt(t.messagesTitle, { name: messagesOf.name[lang] }) : ""}
        description={t.messagesDesc}
        footer={<Button onClick={() => setMessagesOf(null)}>{t.close}</Button>}
      >
        <div className="space-y-4">
          {(messagesOf?.whatsappTemplates ?? []).map((m) => (
            <div key={m.name} className="rounded-[0.5rem] border border-line p-3">
              <p className="text-xs text-ink-soft">{t.templateName}</p>
              <code dir="ltr" className="block select-all font-mono text-sm text-ink text-start">
                {m.name}
              </code>
              <p dir="rtl" className="mt-2 select-all whitespace-pre-wrap rounded bg-paper p-2 text-sm text-ink">
                {m.body}
              </p>
              {m.buttons && m.buttons.length > 0 && (
                <p className="mt-2 text-xs text-ink-soft">
                  {t.buttons}:{" "}
                  {m.buttons.map((b) => (
                    <span key={b} dir="rtl" className="me-1 inline-block rounded-full border border-line px-2 py-0.5 text-ink">
                      {b}
                    </span>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
