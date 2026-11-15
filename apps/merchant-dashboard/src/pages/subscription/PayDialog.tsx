import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, cn, ZLoader } from "@store-builder/ui";
import type { BillingPaymentMethod, BillingPaymentProof, OpenBillingInvoiceResult } from "@store-builder/api-client";
import { apiErrorCode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMinorMoney } from "@/lib/format";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { PAY_STRINGS } from "./payStrings";
import { Modal } from "@/components/Modal";
import { CopyButton } from "@/components/CopyButton";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Paying a subscription invoice: the methods the store is offered, then
 * either a gateway's hosted page or a transfer with its proof. The amount is
 * the server's: opening the dialog asks what paying now comes to
 * (`openBillingInvoice`, which writes nothing, so the plan can still change).
 * The charge is written when the proof is sent, held to the amount shown
 * here; if it has changed meanwhile the new amount is shown instead.
 */
export function PayDialog({
  open,
  methods,
  onClose,
  onProofSent,
}: {
  open: boolean;
  methods: BillingPaymentMethod[];
  onClose: () => void;
  onProofSent: (proof: BillingPaymentProof) => void;
}) {
  const t = useT(PAY_STRINGS);
  return (
    <Modal open={open} onClose={onClose} title={t.title}>
      {open && <PayBody methods={methods} onClose={onClose} onProofSent={onProofSent} />}
    </Modal>
  );
}

function PayBody({
  methods,
  onClose,
  onProofSent,
}: {
  methods: BillingPaymentMethod[];
  onClose: () => void;
  onProofSent: (proof: BillingPaymentProof) => void;
}) {
  const t = useT(PAY_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const groupId = useId();
  const [invoice, setInvoice] = useState<OpenBillingInvoiceResult["invoice"] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState<string>(methods[0]?.code ?? "");
  // Bumped when a proof is refused because the amount changed: asks again, keeping the form.
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    let live = true;
    apiClient
      .openBillingInvoice(workspaceId)
      .then(({ invoice: opened }) => live && setInvoice(opened))
      .catch((err) => live && setLoadError(errorMessage(err, { NO_PAYMENT_METHOD: t.noMethod, PLAN_IS_FREE: t.nothingDue, NO_PLAN: t.nothingDue })));
    return () => {
      live = false;
    };
  }, [workspaceId, errorMessage, t, asked]);

  if (loadError) return <Alert variant="danger">{loadError}</Alert>;
  if (!invoice) {
    return (
      <div className="flex min-h-11 items-center justify-center">
        <ZLoader label={t.loading} />
      </div>
    );
  }

  const chosen = methods.find((m) => m.code === code) ?? null;
  const amount = formatMinorMoney(invoice.amountDue, invoice.currency);

  return (
    <div className="space-y-5">
      <div className="rounded-[10px] border border-line bg-paper px-4 py-3">
        <p className="text-xs text-ink-soft">{t.amountDue}</p>
        <p className="tabular text-lg font-medium text-ink">{amount}</p>
        <p className="mt-1 text-xs text-ink-soft">{t.amountFixed}</p>
      </div>

      <fieldset className="space-y-2">
        <legend id={groupId} className="mb-1 text-sm font-medium text-ink">
          {t.chooseMethod}
        </legend>
        <div role="radiogroup" aria-labelledby={groupId} className="grid gap-2">
          {methods.map((m) => (
            <label
              key={m.code}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-sm",
                m.code === code ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft"
              )}
            >
              <input type="radio" name="pay-method" value={m.code} checked={m.code === code} onChange={() => setCode(m.code)} />
              {m.label[locale] || m.label.en}
            </label>
          ))}
        </div>
      </fieldset>

      {chosen?.kind === "gateway" && <GatewayPay method={chosen} />}
      {chosen?.kind === "manual" && (
        <TransferPay
          key={chosen.code}
          method={chosen}
          amount={amount}
          submit={async (fields) => {
            try {
              return await apiClient.submitBillingPaymentProof(workspaceId, invoice.id, { ...fields, expectedAmount: invoice.amountDue });
            } catch (err) {
              if (apiErrorCode(err) === "CHARGE_AMOUNT_CHANGED") setAsked((n) => n + 1);
              throw err;
            }
          }}
          errorOverrides={{
            CHARGE_AMOUNT_CHANGED: t.amountChanged,
            MANUAL_PAYMENT_CURRENCY_UNSUPPORTED: t.transferCurrency,
            NOTHING_TO_PAY: t.nothingDue,
            PLAN_IS_FREE: t.nothingDue,
            NO_PLAN: t.nothingDue,
          }}
          onCancel={onClose}
          onSent={(proof) => {
            onProofSent(proof);
            onClose();
          }}
        />
      )}
    </div>
  );
}

function GatewayPay({ method }: { method: BillingPaymentMethod }) {
  const t = useT(PAY_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const { payment } = await apiClient.startOnlinePayment(workspaceId, locale, method.code);
      if (!payment.checkoutUrl) throw new Error("no checkout");
      window.location.assign(payment.checkoutUrl);
    } catch (err) {
      setError(
        errorMessage(err, {
          PAYMENT_METHOD_NOT_AVAILABLE: t.methodGone,
          ONLINE_BILLING_DISABLED: t.payDisabled,
          ONLINE_BILLING_UNAVAILABLE: t.payDisabled,
          ONLINE_PAYMENT_CURRENCY_UNSUPPORTED: t.payCurrency,
          ONLINE_PAYMENT_START_FAILED: t.payStartFailed,
          PAYMENT_STARTING: t.payStarting,
          NOTHING_TO_PAY: t.nothingDue,
          PLAN_IS_FREE: t.nothingDue,
          CHARGE_NOT_PENDING: t.notPending,
        })
      );
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">{fmt(t.gatewayHint, { name: method.label[locale] || method.label.en })}</p>
      <Button type="button" onClick={() => void go()} disabled={busy} className="min-h-11 w-full sm:w-auto">
        {busy ? t.opening : t.payOnline}
      </Button>
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}

/**
 * A manual method: where to send `amount` (with a copy button and the
 * method's note), then the number it was sent from and the screenshot, sent
 * through `submit` — an invoice's proof or a top-up's.
 */
export function TransferPay({
  method,
  amount,
  submit,
  onCancel,
  onSent,
  errorOverrides = {},
}: {
  method: BillingPaymentMethod;
  amount: string;
  submit: (fields: { methodCode: string; senderPhone: string; file: File }) => Promise<{ proof: BillingPaymentProof }>;
  onCancel: () => void;
  onSent: (proof: BillingPaymentProof) => void;
  errorOverrides?: Record<string, string>;
}) {
  const t = useT(PAY_STRINGS);
  const { locale } = useLocale();
  const errorMessage = useErrorMessage();
  const phoneId = useId();
  const fileId = useId();
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problems, setProblems] = useState<{ phone?: string; file?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const note = method.note ? method.note[locale] || method.note.en : null;

  function check(): boolean {
    const next: { phone?: string; file?: string } = {};
    if (!phone.trim()) next.phone = t.phoneRequired;
    if (!file) next.file = t.fileRequired;
    else if (!IMAGE_TYPES.has(file.type)) next.file = t.fileType;
    else if (file.size > MAX_BYTES) next.file = t.fileTooLarge;
    setProblems(next);
    return Object.keys(next).length === 0;
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy || !check() || !file) return;
    setBusy(true);
    setError(null);
    try {
      const { proof } = await submit({ methodCode: method.code, senderPhone: phone.trim(), file });
      onSent(proof);
    } catch (err) {
      setError(
        errorMessage(err, {
          PROOF_IMAGE_DUPLICATE: t.duplicate,
          PROOF_ALREADY_OPEN: t.alreadyOpen,
          TOO_MANY_OPEN_PROOFS: t.tooMany,
          CHARGE_NOT_PENDING: t.notPending,
          FILE_TOO_LARGE: t.fileTooLarge,
          UNSUPPORTED_MEDIA_TYPE: t.fileType,
          IMAGE_UNREADABLE: t.unreadable,
          INVALID_SENDER_PHONE: t.invalidPhone,
          PAYMENT_METHOD_NOT_AVAILABLE: t.methodGone,
          NO_FILE: t.fileRequired,
          ...errorOverrides,
        })
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void send(e)} noValidate className="space-y-4">
      <div className="space-y-2 rounded-[10px] border border-line bg-paper px-4 py-3">
        <p className="text-sm text-ink">{fmt(t.sendTo, { amount })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span dir="ltr" className="tabular rounded-md bg-paper-raised px-2 py-1 font-mono text-base text-ink">
            {method.accountNumber}
          </span>
          <CopyButton value={method.accountNumber ?? ""} label={t.copyNumber} />
        </div>
        {/* Only when the console set one: otherwise nothing link-related shows. */}
        {method.paymentLink && (
          <a
            href={method.paymentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center rounded-md border border-line bg-paper-raised px-3 text-sm font-medium text-ink hover:border-primary hover:text-primary"
          >
            {t.payLink}
          </a>
        )}
        {note && <p className="text-sm text-ink-soft">{note}</p>}
        <p className="text-xs text-ink-soft">{t.steps}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={phoneId}>{t.senderPhone}</Label>
        <Input
          id={phoneId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={problems.phone ? true : undefined}
          aria-describedby={`${phoneId}-hint`}
          className="min-h-11"
        />
        <p id={`${phoneId}-hint`} className={cn("text-xs", problems.phone ? "font-medium text-danger" : "text-ink-soft")}>
          {problems.phone ?? t.senderPhoneHint}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={fileId}>{t.screenshot}</Label>
        <input
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-invalid={problems.file ? true : undefined}
          aria-describedby={`${fileId}-hint`}
          className="block w-full text-sm text-ink file:me-3 file:min-h-10 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:text-ink"
        />
        <p id={`${fileId}-hint`} className={cn("text-xs", problems.file ? "font-medium text-danger" : "text-ink-soft")}>
          {problems.file ?? t.screenshotHint}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="min-h-11">
          {t.cancel}
        </Button>
        <Button type="submit" disabled={busy} className="min-h-11">
          {busy ? t.sending : t.send}
        </Button>
      </div>
    </form>
  );
}
