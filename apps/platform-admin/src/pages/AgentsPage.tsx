import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminAgent } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { CodeFields, CommissionTotals } from "@/components/referrals";
import { describeDiscount, initialCodeForm, toCodeInput, type CodeFormState } from "@/lib/referrals";
import { useAuth } from "@/context/AuthContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatBp } from "@/lib/format";
import { P } from "@/lib/permissions";

const STRINGS = {
  en: {
    title: "Agents",
    description: "Referral codes, the merchants who used them, and the commission each payment suggests.",
    newAgent: "New agent",
    commissionNote:
      "Commission is tracking only: Zimos never pays an agent. Each payment a referred merchant makes suggests {rate} of what they paid (or the code’s own rate), and someone marks it paid by hand once they’ve paid it.",
    empty: "No agents yet.",
    colAgent: "Agent",
    colCodes: "Codes",
    colMerchants: "Merchants",
    colCommission: "Suggested commission",
    createdToast: "{email} is now an agent.",
    noLongerAgent: "No longer an agent",
    noCodes: "No codes",
    merchantOne: "· {count} merchant",
    merchantMany: "· {count} merchants",
    inactive: "Inactive",
    noPayments: "No payments yet",
    modalDescription:
      "The person needs an active Zimos account first — there are no invitations. They'll sign in here and see only their own codes and commissions.",
    cancel: "Cancel",
    creating: "Creating…",
    createAgent: "Create agent",
    accountEmail: "Account email",
    firstCode: "Add their first referral code now",
    firstCodeHint: "You can add more codes later, for example one per area.",
  },
  ar: {
    title: "الوكلاء",
    description: "رموز الإحالة، والتجار الذين استخدموها، والعمولة المقترحة عن كل دفعة.",
    newAgent: "وكيل جديد",
    commissionNote:
      "العمولة للمتابعة فقط: لا تدفع Zimos لأي وكيل. كل دفعة يسددها تاجر مُحال تقترح {rate} مما دفعه (أو نسبة الرمز نفسه)، ويُعلّمها شخص ما كمدفوعة يدويًا بعد دفعها.",
    empty: "لا يوجد وكلاء بعد.",
    colAgent: "الوكيل",
    colCodes: "الرموز",
    colMerchants: "التجار",
    colCommission: "العمولة المقترحة",
    createdToast: "أصبح {email} وكيلًا.",
    noLongerAgent: "لم يعد وكيلًا",
    noCodes: "لا توجد رموز",
    merchantOne: "· تاجر واحد",
    merchantMany: "· عدد التجار: {count}",
    inactive: "غير نشط",
    noPayments: "لا توجد مدفوعات بعد",
    modalDescription:
      "يحتاج الشخص إلى حساب Zimos نشط أولًا — لا توجد دعوات. سيسجّل الدخول هنا ولن يرى إلا رموزه وعمولاته.",
    cancel: "إلغاء",
    creating: "جارٍ الإنشاء…",
    createAgent: "إنشاء الوكيل",
    accountEmail: "البريد الإلكتروني للحساب",
    firstCode: "إضافة أول رمز إحالة له الآن",
    firstCodeHint: "يمكنك إضافة رموز أخرى لاحقًا، مثلًا رمز لكل منطقة.",
  },
} satisfies Messages;

export function AgentsPage() {
  const t = useT(STRINGS);
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listAgents(), []);
  const [creating, setCreating] = useState(false);

  const agents = data?.agents ?? [];
  const defaultRateBp = data?.defaultCommissionRateBp ?? 3000;

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          can(P.AGENTS_MANAGE) && (
            <Button onClick={() => setCreating(true)}>
              <UserPlus /> {t.newAgent}
            </Button>
          )
        }
      />

      <Alert className="mb-4">{fmt(t.commissionNote, { rate: formatBp(defaultRateBp) })}</Alert>

      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {agents.length === 0 ? (
          <EmptyBlock message={t.empty} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.colAgent}</Th>
                  <Th>{t.colCodes}</Th>
                  <Th className="text-end">{t.colMerchants}</Th>
                  <Th>{t.colCommission}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      {creating && (
        <CreateAgentModal
          defaultRateBp={defaultRateBp}
          onClose={() => setCreating(false)}
          onCreated={(email) => {
            toast.success(fmt(t.createdToast, { email }));
            setCreating(false);
            void refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function AgentRow({ agent }: { agent: AdminAgent }) {
  const t = useT(STRINGS);
  return (
    <TableRow>
      <Td className="align-top">
        <Link to={`/agents/${agent.id}`} className="font-medium hover:text-primary hover:underline">
          {agent.fullName}
        </Link>
        {!agent.isAgent && (
          <StatusBadge tone="neutral" className="ms-2">
            {t.noLongerAgent}
          </StatusBadge>
        )}
        <span className="block text-xs text-ink-soft">{agent.email}</span>
      </Td>
      <Td className="align-top">
        {agent.codes.length === 0 ? (
          <span className="text-sm text-ink-soft">{t.noCodes}</span>
        ) : (
          <ul className="space-y-1.5">
            {agent.codes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Mono>{c.code}</Mono>
                {c.label && <span className="text-ink-soft">{c.label}</span>}
                <span className="text-xs text-ink-soft">{describeDiscount(c)}</span>
                <span className="text-xs text-ink-soft">
                  {fmt(c.merchantsReferred === 1 ? t.merchantOne : t.merchantMany, { count: c.merchantsReferred })}
                </span>
                {!c.active && <StatusBadge tone="neutral">{t.inactive}</StatusBadge>}
              </li>
            ))}
          </ul>
        )}
      </Td>
      <Td className="text-end align-top text-sm">{agent.merchantsReferred}</Td>
      <Td className="align-top">
        <CommissionTotals totals={agent.commission} empty={t.noPayments} />
      </Td>
    </TableRow>
  );
}

function CreateAgentModal({
  defaultRateBp,
  onClose,
  onCreated,
}: {
  defaultRateBp: number;
  onClose: () => void;
  onCreated: (email: string) => void;
}) {
  const t = useT(STRINGS);
  const [email, setEmail] = useState("");
  const [withCode, setWithCode] = useState(true);
  const [code, setCode] = useState<CodeFormState>(() => initialCodeForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let firstCode;
    try {
      firstCode = withCode ? { ...toCodeInput(code, { includeCode: true }), code: code.code.trim().toUpperCase() } : undefined;
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }
    setBusy(true);
    try {
      await adminApi.createAgent({ email: email.trim(), firstCode });
      onCreated(email.trim());
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t.newAgent}
      description={t.modalDescription}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            form="agent-form"
            disabled={busy || !email.trim() || (withCode && code.code.trim().length < 3)}
          >
            {busy ? t.creating : t.createAgent}
          </Button>
        </>
      }
    >
      <form id="agent-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField
          label={t.accountEmail}
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Toggle
          label={t.firstCode}
          description={t.firstCodeHint}
          checked={withCode}
          onChange={setWithCode}
        />
        {withCode && <CodeFields form={code} setForm={setCode} creating defaultRateBp={defaultRateBp} />}
      </form>
    </Modal>
  );
}
