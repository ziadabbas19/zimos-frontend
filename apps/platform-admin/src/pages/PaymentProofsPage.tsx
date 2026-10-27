import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { FilterChips } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime, formatMinorMoneyExact, formatRelative } from "@/lib/format";
import { Pager } from "@/pages/BlocklistPage";
import { PROOF_STATUS_LABEL } from "@/lib/paymentProofs";

type Filter = "pending" | "approved" | "rejected" | "all";
const PAGE_SIZE = 20;

const STRINGS = {
  en: {
    title: "Transfer proofs",
    description: "Merchants who paid by InstaPay or a wallet. Check the money arrived before approving.",
    refresh: "Refresh",
    waiting: "Waiting",
    approved: "Approved",
    rejected: "Rejected",
    all: "All",
    emptyPending: "No transfer is waiting for review.",
    emptyOther: "No proofs match.",
    colStore: "Store",
    colFor: "For",
    colMethod: "Method",
    colSender: "Sender",
    colAmount: "Amount asked",
    colSent: "Sent",
    colStatus: "Status",
    deletedStore: "Deleted store",
    invoice: "Subscription invoice",
    topUp: "Balance top-up",
  },
  ar: {
    title: "إثباتات التحويل",
    description: "التجار الذين دفعوا عبر إنستاباي أو محفظة. تحقّق من وصول المبلغ قبل الموافقة.",
    refresh: "تحديث",
    waiting: "قيد الانتظار",
    approved: "مقبولة",
    rejected: "مرفوضة",
    all: "الكل",
    emptyPending: "لا يوجد تحويل بانتظار المراجعة.",
    emptyOther: "لا توجد إثباتات مطابقة.",
    colStore: "المتجر",
    colFor: "الغرض",
    colMethod: "الطريقة",
    colSender: "المرسِل",
    colAmount: "المبلغ المطلوب",
    colSent: "تاريخ الإرسال",
    colStatus: "الحالة",
    deletedStore: "متجر محذوف",
    invoice: "فاتورة اشتراك",
    topUp: "شحن الرصيد",
  },
} satisfies Messages;

/** Merchants' transfer proofs: the waiting ones oldest first, to be checked against the money that arrived. */
export function PaymentProofsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [status, setStatus] = useState<Filter>("pending");
  const [page, setPage] = useState({ status, offset: 0 });
  const offset = page.status === status ? page.offset : 0;
  const { data, loading, error, refresh } = useAsync(
    () => adminApi.listPaymentProofs({ status, page: offset / PAGE_SIZE + 1, pageSize: PAGE_SIZE }),
    [status, offset]
  );
  const proofs = data?.proofs ?? [];

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> {t.refresh}
          </Button>
        }
      />
      <FilterChips
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: "pending", label: t.waiting },
          { value: "approved", label: t.approved },
          { value: "rejected", label: t.rejected },
          { value: "all", label: t.all },
        ]}
      />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {proofs.length === 0 ? (
          <EmptyBlock message={status === "pending" ? t.emptyPending : t.emptyOther} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.colStore}</Th>
                  <Th>{t.colFor}</Th>
                  <Th>{t.colMethod}</Th>
                  <Th>{t.colSender}</Th>
                  <Th className="text-end">{t.colAmount}</Th>
                  <Th>{t.colSent}</Th>
                  <Th>{t.colStatus}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proofs.map((p) => (
                  <TableRow key={p.id}>
                    <Td>
                      <Link to={`/payment-proofs/${p.id}`} className="font-medium text-ink hover:text-primary">
                        {p.workspace.name ?? t.deletedStore}
                      </Link>
                    </Td>
                    <Td className="text-sm">{p.purpose === "invoice" ? t.invoice : t.topUp}</Td>
                    <Td className="text-sm">{(locale === "ar" ? p.method.labelAr : p.method.labelEn) ?? p.method.labelEn ?? p.method.code}</Td>
                    <Td className="font-mono text-sm">
                      <span dir="ltr">{p.senderPhone}</span>
                    </Td>
                    <Td className="tabular text-end text-sm">{formatMinorMoneyExact(p.requestedAmount, p.currency)}</Td>
                    <Td className="whitespace-nowrap text-sm">
                      <span title={formatDateTime(p.createdAt)}>{formatRelative(p.createdAt)}</span>
                    </Td>
                    <Td>
                      <Status value={p.status === "approved" ? "active" : p.status === "rejected" ? "failed" : "pending"} label={PROOF_STATUS_LABEL[p.status]} />
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
        {data && <Pager total={data.total} limit={PAGE_SIZE} offset={offset} onOffset={(next) => setPage({ status, offset: next })} />}
      </DataState>
    </div>
  );
}
