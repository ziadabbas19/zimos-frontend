import { useMemo, useState, type FormEvent } from "react";
import { Button, Input, Label, cn } from "@store-builder/ui";
import {
  funnelsDelete,
  funnelsList,
  funnelsListSteps,
  funnelsPause,
  funnelsProblemsOf,
  funnelsPublish,
  funnelsResume,
  type FunnelDto,
  type FunnelStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  IconChart,
  IconClick,
  IconCopy,
  IconDelete,
  IconExternal,
  IconEye,
  IconFunnels,
  IconLaunch,
  IconLink,
  IconOrders,
  IconPause,
  IconPlay,
  IconPlus,
  IconSearch,
  IconShare,
  IconWallet,
} from "@/components/icons";
import { RangeSwitch } from "@/components/RangeSwitch";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { EmptyState } from "@/components/EmptyState";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { useToast } from "@/components/Toast";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { fmt, getIntlLocale, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import {
  STARTER_TEMPLATE_IDS,
  createFunnelFromStarter,
  duplicateFunnel,
  starterPlan,
  useFunnelErrorMessage,
  type StarterTemplateId,
  type UiStepType,
} from "./funnelAdapter";
import { STARTER_TEMPLATE_TEXT } from "./FunnelEditorPage.strings";
import { StepChain } from "./StepChain";
import { funnelPreviewUrl, useStoreBaseUrl } from "./FunnelPublicLink";
import { FunnelShareDialog, FunnelWizard } from "./FunnelWizard";
import { FunnelDesk, FunnelRow } from "./list/FunnelRow";
import { FunnelStats, type FunnelStat } from "./list/FunnelStats";
import { FUNNEL_LIST_STRINGS } from "./list/funnelListStrings";

const FORM_STRINGS = {
  en: {
    name: "Name",
    nameRequired: "Give the funnel a name.",
    namePlaceholder: "Headphones Pro offer — Ramadan",
    startFrom: "Start from",
    toastCreated: "\"{name}\" created.",
    toastCreatedPartial: "The funnel was created but its starter steps couldn't all be added: {message}",
    creating: "Creating…",
    createAndOpen: "Create and open editor",
  },
  ar: {
    name: "الاسم",
    nameRequired: "اكتب اسمًا لمسار البيع.",
    namePlaceholder: "عرض السماعة Pro — رمضان",
    startFrom: "ابدأ من",
    toastCreated: "تم إنشاء «{name}».",
    toastCreatedPartial: "تم إنشاء مسار البيع لكن تعذّرت إضافة كل الخطوات المبدئية: {message}",
    creating: "جارٍ الإنشاء…",
    createAndOpen: "إنشاء وفتح المحرر",
  },
} satisfies Messages;

type StatusFilter = "all" | FunnelStatus;
const STATUS_ORDER: FunnelStatus[] = ["published", "draft", "paused"];

interface StartTemplate {
  id: StarterTemplateId;
  name: string;
  description: string;
  types: UiStepType[];
}

/** Names/descriptions live in FunnelEditorPage.strings (the editor offers the same starters on an empty funnel). */
function startTemplates(locale: Locale): StartTemplate[] {
  return STARTER_TEMPLATE_IDS.map((id) => ({
    id,
    ...STARTER_TEMPLATE_TEXT[locale][id],
    types: starterPlan(id, locale).steps.map((s) => s.type),
  }));
}

function partialIdOf(err: unknown): string | null {
  const id = (err as { partialFunnelId?: unknown } | null)?.partialFunnelId;
  return typeof id === "string" ? id : null;
}

/**
 * /funnels on the list pattern: the header with "New funnel", four compact
 * stat cards, one toolbar (search by name), the statuses as chips with their
 * counts, then the funnels: a card each on a phone, a sheet of rows on a wide
 * screen. A row opens the editor; "…", a right-click or a long press holds
 * the rest.
 *
 * Nothing here changes what is saved or who may do it: the same calls as the
 * table this replaced, and the link of a funnel is still the store's own
 * (FunnelPublicLink). Search and the status chips narrow the list in the
 * browser: the endpoint returns every funnel at once.
 */
export function FunnelsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const t = useT(FUNNEL_LIST_STRINGS);
  const describeError = useFunnelErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();
  const list = useAsync(() => funnelsList(apiClient, workspaceId), [workspaceId]);
  const storeBase = useStoreBaseUrl();

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FunnelDto | null>(null);
  const [sharing, setSharing] = useState<FunnelDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const funnels = useMemo(() => list.data ?? [], [list.data]);
  const reload = () => list.refresh({ silent: true });

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return funnels.filter(
      (f) => (status === "all" || f.status === status) && (!q || f.name.toLocaleLowerCase().includes(q) || (f.subdomain ?? "").toLocaleLowerCase().includes(q))
    );
  }, [funnels, query, status]);
  const filtered = query.trim() !== "" || status !== "all";

  // The list endpoint has no step count; fetch each funnel's steps (read-only, parallel).
  const idsKey = funnels.map((f) => f.id).join(",");
  const stepCounts = useAsync(async () => {
    const entries = await Promise.all(
      funnels.map(async (f) => [f.id, (await funnelsListSteps(apiClient, workspaceId, f.id)).length] as const)
    );
    return new Map(entries);
  }, [workspaceId, idsKey]);

  // Funnel stats need analytics.view; a role without it gets dashes and one sentence, not a 403.
  const { currentWorkspace } = useWorkspace();
  const analyticsAllowed = canViewAnalytics(currentWorkspace?.role);
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const stats = useAsync(
    () =>
      analyticsAllowed ? apiClient.getFunnelAnalytics(workspaceId, rangeWindows(range).current) : Promise.resolve(null),
    [workspaceId, range, analyticsAllowed]
  );
  const statsById = new Map((stats.data?.funnels ?? []).map((row) => [row.id, row]));
  const currency = stats.data?.currency ?? "EGP";
  const totals = stats.data?.totals;
  const digits = new Intl.NumberFormat(getIntlLocale());
  const figure = (value: number | null | undefined, render: (v: number) => string) =>
    value === null || value === undefined ? null : <bdi dir="ltr">{render(value)}</bdi>;
  const statCards: FunnelStat[] = [
    { id: "visits", label: t.kpiVisits, icon: IconEye, value: figure(totals?.sessions, digits.format) },
    { id: "orders", label: t.kpiOrders, icon: IconOrders, value: figure(totals?.orders, digits.format) },
    { id: "revenue", label: t.kpiRevenue, icon: IconWallet, value: figure(totals?.revenue, (v) => formatMoney(v, currency)), hint: t.kpiRevenueHint },
    {
      id: "conversion",
      label: t.kpiConversion,
      icon: IconClick,
      value: figure(totals?.conversionRate, (v) => formatPercentValue(percentToRatio(v))),
      hint: t.kpiConversionHint,
    },
  ];
  /** Shown when the stats failed or aren't allowed: never a made-up number. */
  const noStatReason = !analyticsAllowed ? t.statsNoAccess : stats.error ? t.statsUnavailable : undefined;

  async function changeStatus(f: FunnelDto) {
    setBusyId(f.id);
    try {
      if (f.status === "published") {
        await funnelsPause(apiClient, workspaceId, f.id);
        // Pausing is undone by resuming: the same permission, the same call the menu makes.
        toast.undo(fmt(t.toastPaused, { name: f.name }), async () => {
          await funnelsResume(apiClient, workspaceId, f.id);
          await reload();
        });
      } else if (f.status === "paused") {
        await funnelsResume(apiClient, workspaceId, f.id);
        toast.undo(fmt(t.toastResumed, { name: f.name }), async () => {
          await funnelsPause(apiClient, workspaceId, f.id);
          await reload();
        });
      } else {
        await funnelsPublish(apiClient, workspaceId, f.id);
        toast.success(fmt(t.toastLive, { name: f.name }));
      }
      await reload();
    } catch (err) {
      const problems = funnelsProblemsOf(err);
      toast.error(problems.length > 0 ? fmt(t.toastPublishBlocked, { name: f.name, n: problems.length }) : describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(f: FunnelDto) {
    setBusyId(f.id);
    try {
      const copy = await duplicateFunnel(workspaceId, f.id, (name) => fmt(t.copySuffix, { name }));
      toast.success(fmt(t.toastDuplicatedAs, { name: copy.name }));
      navigate(`/funnels/${copy.id}`);
    } catch (err) {
      const partial = partialIdOf(err);
      if (partial) {
        toast.error(fmt(t.toastDuplicatePartial, { message: describeError(err) }));
        navigate(`/funnels/${partial}`);
      } else {
        toast.error(describeError(err));
        await reload();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.toastCopied);
    } catch {
      toast.error(t.toastCopyFailed);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await funnelsDelete(apiClient, workspaceId, deleting.id);
    } catch (err) {
      throw new Error(describeError(err));
    }
    toast.success(fmt(t.toastDeleted, { name: deleting.name }));
    setDeleting(null);
    await reload();
  }

  /** The row's menu: the same list for "…", a right-click and a long press. */
  function menuFor(f: FunnelDto): ContextMenuItem[] {
    const busy = busyId === f.id;
    // The store's own link (its connected domain, else the store address): null until there is one to open.
    const url = funnelPreviewUrl(storeBase, f);
    const items: ContextMenuItem[] = [];
    if (url) {
      items.push({ id: "preview", label: t.preview, icon: IconExternal, onSelect: () => void window.open(url, "_blank", "noopener,noreferrer") });
      items.push({ id: "copy-link", label: t.copyLink, icon: IconLink, onSelect: () => void copyLink(url) });
    }
    if (analyticsAllowed) items.push({ id: "report", label: t.report, icon: IconChart, onSelect: () => navigate(`/analytics/funnels/${f.id}`) });
    items.push({
      id: "status",
      label: f.status === "published" ? t.pause : f.status === "paused" ? t.resume : t.publish,
      icon: f.status === "published" ? IconPause : f.status === "paused" ? IconPlay : IconLaunch,
      disabled: busy,
      onSelect: () => void changeStatus(f),
    });
    items.push({ id: "duplicate", label: t.duplicate, icon: IconCopy, disabled: busyId !== null, onSelect: () => void duplicate(f) });
    items.push({ id: "share", label: t.shareCode, icon: IconShare, onSelect: () => setSharing(f) });
    items.push({ id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(f) });
    return items;
  }

  const newFunnel = (
    <Button className="min-h-11 rounded-full px-5" onClick={() => setCreating(true)}>
      <IconPlus className="size-4" aria-hidden />
      {t.newFunnel}
    </Button>
  );

  const count = (s: FunnelStatus) => funnels.filter((f) => f.status === s).length;
  const statusLabels: Record<FunnelStatus, string> = { draft: t.statusDraft, published: t.statusPublished, paused: t.statusPaused };
  const chips: ChipItem<StatusFilter>[] = [
    { value: "all", label: t.all, count: funnels.length },
    ...STATUS_ORDER.map((s) => ({ value: s, label: statusLabels[s], count: count(s), tone: s === "paused" ? ("attention" as const) : ("default" as const) })),
  ];

  const lines = shown.map((f) => (
    <FunnelRow
      key={f.id}
      t={t}
      funnel={f}
      compact={compact}
      stepCount={stepCounts.data?.get(f.id)}
      stats={statsById.get(f.id)}
      showStats={analyticsAllowed}
      currency={currency}
      menu={menuFor(f)}
      busy={busyId === f.id}
    />
  ));

  const firstLoad = list.loading && !list.data;
  const nothingYet = !firstLoad && !list.error && funnels.length === 0;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the funnels: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        actions={analyticsAllowed && !nothingYet ? <RangeSwitch value={range} onChange={setRange} /> : undefined}
        primaryAction={newFunnel}
      />

      <DataState
        loading={firstLoad}
        error={list.data ? null : list.error}
        onRetry={() => void list.refresh()}
        skeleton={
          <div className="flex flex-col gap-3">
            <FunnelStats stats={statCards} label={t.stats} loading />
            <ListSkeleton variant={compact ? "card" : "table"} rows={5} />
          </div>
        }
      >
        {nothingYet ? (
          <EmptyState
            icon={<IconFunnels aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Button className="min-h-11 rounded-full px-5" onClick={() => setCreating(true)}>
                <IconPlus className="size-4" aria-hidden />
                {t.emptyAction}
              </Button>
            }
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <FunnelStats stats={statCards} label={t.stats} loading={analyticsAllowed && stats.loading && !stats.data} reason={noStatReason} />

            <ListToolbar search={{ value: query, onChange: setQuery, placeholder: t.searchPlaceholder, label: t.search }} />
            <ChipRow items={chips} value={status} onChange={setStatus} label={t.statuses} />

            {shown.length === 0 ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.noMatchTitle}
                description={filtered ? t.noMatchBody : undefined}
                action={
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-full px-5"
                    onClick={() => {
                      setQuery("");
                      setStatus("all");
                    }}
                  >
                    {t.showAll}
                  </Button>
                }
              />
            ) : compact ? (
              <ul aria-label={t.list} className="flex flex-col gap-2.5">
                {lines}
              </ul>
            ) : (
              <FunnelDesk t={t} showStats={analyticsAllowed}>
                {lines}
              </FunnelDesk>
            )}
          </div>
        )}
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title={t.modalTitle} description={t.modalDescription}>
        {creating && <FunnelWizard onCancel={() => setCreating(false)} onCreated={(id) => navigate(`/funnels/${id}`)} />}
      </Modal>

      <FunnelShareDialog funnel={sharing} onClose={() => setSharing(null)} />

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? fmt(t.deleteTitle, { name: deleting.name }) : ""}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/** The one-screen form the wizard replaced; kept for callers that want name + template only. */
export function CreateFunnelForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(FORM_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const describeError = useFunnelErrorMessage();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<StarterTemplateId>("blank");
  const templates = useMemo(() => startTemplates(locale), [locale]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.nameRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const funnel = await createFunnelFromStarter(workspaceId, name.trim(), templateId, locale);
      toast.success(fmt(t.toastCreated, { name: funnel.name }));
      onCreated(funnel.id);
    } catch (err) {
      const partial = partialIdOf(err);
      if (partial) {
        toast.error(fmt(t.toastCreatedPartial, { message: describeError(err) }));
        onCreated(partial);
        return;
      }
      setError(describeError(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="funnel-name">{t.name}</Label>
        <Input id="funnel-name" dir="auto" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoFocus />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
      </div>

      <div className="space-y-2">
        <Label>{t.startFrom}</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((tpl) => {
            const active = tpl.id === templateId;
            return (
              <label
                key={tpl.id}
                className={cn(
                  "cursor-pointer rounded-2xl border p-3 transition-colors",
                  active ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "border-line hover:border-primary/50"
                )}
              >
                <input type="radio" name="funnel-template" className="sr-only" checked={active} onChange={() => setTemplateId(tpl.id)} />
                <p className={cn("text-sm font-semibold", active ? "text-primary-dark" : "text-ink")}>{tpl.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{tpl.description}</p>
                <StepChain types={tpl.types} className="mt-2" />
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.creating : t.createAndOpen}
        </Button>
      </div>
    </form>
  );
}
