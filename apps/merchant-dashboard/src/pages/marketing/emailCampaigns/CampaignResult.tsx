import { useCallback, useEffect, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  emailCampaignCancel,
  emailCampaignRecipients,
  type EmailCampaign,
  type EmailCampaignOverview,
  type EmailCampaignRecipient,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState, TableSkeleton } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { formatDateTime, formatPercentValue } from "@/lib/format";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT } from "@/i18n/LocaleContext";
import { CAMPAIGN_STRINGS, type CampaignText } from "./campaignStrings";
import { CampaignStatusBadge } from "./EmailCampaignsPage";

type RecipientTab = "all" | EmailCampaignRecipient["status"];
const RECIPIENT_TABS: RecipientTab[] = ["all", "sent", "failed", "skipped", "queued", "cancelled"];
const RECIPIENT_TONE: Record<EmailCampaignRecipient["status"], "neutral" | "info" | "success" | "warning" | "danger"> = {
  queued: "neutral",
  sending: "info",
  sent: "success",
  failed: "danger",
  skipped: "warning",
  cancelled: "neutral",
};

const recipientLabel = (t: CampaignText, s: EmailCampaignRecipient["status"]) => t[`recipientStatus_${s}` as keyof CampaignText] as string;

/** A campaign that went (or is going) out: its numbers, its recipients, and the way to stop it while it sends. */
export function CampaignResult({ campaign, overview, onChange }: { campaign: EmailCampaign; overview: EmailCampaignOverview | null; onChange: (c: EmailCampaign) => void }) {
  const t = useT(CAMPAIGN_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [tab, setTab] = useState<RecipientTab>("all");
  const [rows, setRows] = useState<EmailCampaignRecipient[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const engagement = Boolean(overview?.provider.reportsEngagement);
  const s = campaign.stats;

  const load = useCallback(
    async (next: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const page = await emailCampaignRecipients(apiClient, workspaceId, campaign.id, { status: tab === "all" ? undefined : tab, cursor: next ?? undefined });
        setRows((prev) => (next ? [...prev, ...page.recipients] : page.recipients));
        setCursor(page.nextCursor);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, campaign.id, tab]
  );
  useEffect(() => {
    setRows([]);
    void load(null);
  }, [load]);

  const rate = (n: number) => (s.sent > 0 ? formatPercentValue(n / s.sent) : "—");
  const figures: Array<[string, number, string | null]> = [
    [t.recipients, s.recipients, null],
    [t.sent, s.sent, null],
    ...(engagement
      ? ([
          [t.delivered, s.delivered, rate(s.delivered)],
          [t.opened, s.opened, rate(s.opened)],
          [t.clicked, s.clicked, rate(s.clicked)],
        ] as Array<[string, number, string | null]>)
      : []),
    [t.failed, s.failed, null],
    [t.skipped, s.skipped, null],
    [t.unsubscribed, s.unsubscribed, rate(s.unsubscribed)],
    ...(engagement ? ([[t.bounced, s.bounced, null], [t.complained, s.complained, null]] as Array<[string, number, string | null]>) : []),
  ];

  const columns: Column<EmailCampaignRecipient>[] = [
    { key: "email", header: t.email, cell: (r) => <span dir="ltr" className="break-all">{r.email}</span> },
    { key: "status", header: t.status, cell: (r) => <StatusBadge value={r.status} tone={RECIPIENT_TONE[r.status]} text={recipientLabel(t, r.status)} /> },
    {
      key: "detail",
      header: t.detail,
      phoneSkip: (r) => !r.error && !r.openedAt && !r.unsubscribedAt && !r.deliveryStatus,
      cell: (r) => (
        <span className="text-xs text-ink-soft">
          {[r.deliveryStatus && t[r.deliveryStatus as keyof CampaignText], r.openedAt && t.opened, r.clickedAt && t.clicked, r.unsubscribedAt && t.unsubscribed, r.error]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      ),
    },
    { key: "sentAt", header: t.when, phoneSkip: (r) => !r.sentAt, cell: (r) => <span className="whitespace-nowrap text-ink-soft">{r.sentAt ? formatDateTime(r.sentAt) : "—"}</span> },
  ];

  return (
    <div className="min-w-0">
      <PageHeader
        title={campaign.name}
        titleBadge={<CampaignStatusBadge status={campaign.status} />}
        description={campaign.subject}
        back={{ to: "/marketing/email-campaigns", label: t.back }}
        actions={
          campaign.status === "sending" ? (
            <Button variant="outline" className="min-h-11 text-danger" onClick={() => setConfirmCancel(true)}>
              {t.cancel}
            </Button>
          ) : undefined
        }
      />

      {campaign.failureReason && (
        <Alert variant="danger" className="mb-5">
          {t[`failure_${campaign.failureReason}` as keyof CampaignText] ?? t.failure_start_failed}
        </Alert>
      )}
      {campaign.status === "sending" && campaign.pausedUntil && (
        <Alert variant="info" className="mb-5">
          {fmt(t.pausedUntil, { date: formatDateTime(campaign.pausedUntil) })}
        </Alert>
      )}

      <Section title={t.results} description={engagement ? t.resultsHint : t.resultsBasic} className="mb-5">
        <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {figures.map(([label, value, share]) => (
            <div key={label} className="bg-paper-raised p-3">
              <dt className="text-xs text-ink-soft">{label}</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-semibold text-ink tabular-nums">{formatCount(value)}</span>
                {share && <span className="text-xs text-ink-soft tabular-nums">{share}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t.recipientsList} flush>
        <div className="px-4 pb-4">
          <FilterTabs
            label={t.recipientsList}
            value={tab}
            onChange={setTab}
            className="mb-3"
            buttonClassName="pointer-coarse:min-h-11"
            tabs={RECIPIENT_TABS.map((value) => ({ value, label: value === "all" ? t.all : recipientLabel(t, value) }))}
          />
          <DataState loading={loading && rows.length === 0 && !error} error={error} onRetry={() => void load(null)} skeleton={<TableSkeleton />}>
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} minWidth="40rem" empty={<p className="py-6 text-center text-sm text-ink-soft">—</p>} />
            <LoadMore hasMore={Boolean(cursor)} loading={loading} onClick={() => void load(cursor)} />
          </DataState>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmCancel}
        title={t.cancelConfirm}
        description={t.cancelBody}
        confirmLabel={t.cancel}
        cancelLabel={t.keep}
        destructive
        onCancel={() => setConfirmCancel(false)}
        onConfirm={async () => {
          const next = await emailCampaignCancel(apiClient, workspaceId, campaign.id);
          setConfirmCancel(false);
          onChange(next);
          toast.success(t.cancelled);
        }}
      />
    </div>
  );
}
