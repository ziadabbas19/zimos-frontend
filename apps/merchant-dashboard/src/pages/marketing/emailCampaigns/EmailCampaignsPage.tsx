import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Plus } from "lucide-react";
import { Button } from "@store-builder/ui";
import {
  emailCampaignList,
  emailCampaignOverview,
  type EmailCampaign,
  type EmailCampaignStatus,
} from "@store-builder/api-client";
import { DataState, TableSkeleton } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { PageActionBar, PageHeader } from "@/components/PageHeader";
import { PlanFeatureNotice } from "@/components/PlanFeatureNotice";
import { StatusBadge } from "@/components/StatusBadge";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { usePlanFeatures } from "@/lib/usePlanFeatures";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT } from "@/i18n/LocaleContext";
import { CAMPAIGN_STRINGS, type CampaignText } from "./campaignStrings";
import { QuotaMeter } from "./QuotaMeter";

type Tab = "all" | EmailCampaignStatus;
const TABS: Tab[] = ["all", "draft", "scheduled", "sending", "sent"];
const TONE: Record<EmailCampaignStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  scheduled: "info",
  sending: "warning",
  sent: "success",
  failed: "danger",
  cancelled: "neutral",
};

export function statusLabel(t: CampaignText, status: EmailCampaignStatus) {
  return t[`status_${status}` as keyof CampaignText] as string;
}

export function CampaignStatusBadge({ status }: { status: EmailCampaignStatus }) {
  const t = useT(CAMPAIGN_STRINGS);
  return <StatusBadge value={status} tone={TONE[status]} text={statusLabel(t, status)} />;
}

/** The date that says most about a campaign: when it goes, went, or was written. */
function whenOf(c: EmailCampaign) {
  return c.status === "scheduled" ? c.scheduledAt : c.startedAt ?? c.updatedAt;
}

/** /marketing/email-campaigns — EMAIL_CAMPAIGNS_ENABLED. */
export function EmailCampaignsPage() {
  const t = useT(CAMPAIGN_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const plan = usePlanFeatures();
  const locked = plan.gated("email_campaigns");
  const [tab, setTab] = useState<Tab>("all");
  const overview = useAsync(() => (locked ? Promise.resolve(null) : emailCampaignOverview(apiClient, workspaceId)), [workspaceId, locked]);

  const [rows, setRows] = useState<EmailCampaign[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(
    async (next: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const page = await emailCampaignList(apiClient, workspaceId, { status: tab === "all" ? undefined : tab, cursor: next ?? undefined });
        setRows((prev) => (next ? [...prev, ...page.campaigns] : page.campaigns));
        setCursor(page.nextCursor);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, tab]
  );
  useEffect(() => {
    if (locked) return;
    setRows([]);
    void load(null);
  }, [load, locked]);

  if (locked) {
    return (
      <div className="min-w-0">
        <PageHeader title={t.title} description={t.description} />
        <PlanFeatureNotice feature="email_campaigns" />
      </div>
    );
  }

  const engagement = Boolean(overview.data?.provider.reportsEngagement);
  const stat = (key: "sent" | "delivered" | "opened" | "clicked" | "failed" | "unsubscribed", header: string) => ({
    key,
    header,
    align: "end" as const,
    phoneSkip: (c: EmailCampaign) => c.stats[key] === 0,
    cell: (c: EmailCampaign) => (c.status === "draft" || c.status === "scheduled" ? "—" : formatCount(c.stats[key])),
  });
  const columns: Column<EmailCampaign>[] = [
    {
      key: "name",
      header: t.name,
      cell: (c) => (
        <span className="min-w-0">
          <Link to={`/marketing/email-campaigns/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline" dir="auto">
            {c.name}
          </Link>
          {c.subject && (
            <span className="block truncate text-xs text-ink-soft" dir="auto">
              {c.subject}
            </span>
          )}
        </span>
      ),
    },
    { key: "status", header: t.status, cell: (c) => <CampaignStatusBadge status={c.status} /> },
    { key: "when", header: t.when, cell: (c) => <span className="whitespace-nowrap text-ink-soft">{formatDateTime(whenOf(c))}</span> },
    { key: "recipients", header: t.recipients, align: "end", phoneSkip: (c) => c.stats.recipients === 0, cell: (c) => (c.stats.recipients ? formatCount(c.stats.recipients) : "—") },
    stat("sent", t.sent),
    ...(engagement ? [stat("delivered", t.delivered), stat("opened", t.opened), stat("clicked", t.clicked)] : []),
    stat("failed", t.failed),
    stat("unsubscribed", t.unsubscribed),
  ];

  const create = (
    <Button asChild className="min-h-11">
      <Link to="/marketing/email-campaigns/new">
        <Plus className="size-4" aria-hidden />
        {t.newCampaign}
      </Link>
    </Button>
  );

  return (
    <div className="min-w-0">
      <PageHeader title={t.title} description={t.description} primaryAction={create} />
      <PageActionBar>{create}</PageActionBar>

      {overview.data && <QuotaMeter overview={overview.data} className="mb-5" />}

      <FilterTabs
        label={t.filter}
        value={tab}
        onChange={setTab}
        className="mb-4"
        buttonClassName="min-h-11 sm:min-h-0 pointer-coarse:min-h-11"
        tabs={TABS.map((value) => ({ value, label: value === "all" ? t.all : statusLabel(t, value) }))}
      />

      <DataState loading={loading && rows.length === 0 && !error} error={error} onRetry={() => void load(null)} skeleton={<TableSkeleton />}>
        {rows.length === 0 ? (
          <EmptyState icon={<Mail aria-hidden />} title={t.emptyTitle} description={t.emptyBody} action={tab === "all" ? create : undefined} />
        ) : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/marketing/email-campaigns/${c.id}`)} minWidth="52rem" />
            <LoadMore hasMore={Boolean(cursor)} loading={loading} onClick={() => void load(cursor)} />
          </>
        )}
      </DataState>
      {/* Room for the phone's fixed action bar. */}
      <div className="h-20 md:hidden" aria-hidden />
    </div>
  );
}
