import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import { apiFieldProblems, lostOrdersConvert, type LostOrder } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { IconEye, IconSpinner } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { PILL, PILL_LABELLED, PILL_QUIET } from "./LostOrderParts";
import { isMasked, useLast } from "./lostOrderModel";

const STRINGS = {
  en: {
    title: "Convert to an order",
    description: "An order is created from what the shopper typed. Complete or correct it first.",
    items: "What is in the basket",
    line: "{name} × {qty}",
    name: "Customer name",
    phone: "Phone number",
    phoneHidden: "Part of the number is hidden. Show it, or type it in full.",
    reveal: "Show number",
    revealHint: "Showing the number is recorded in the activity log",
    governorate: "Governorate",
    city: "City",
    address: "Address",
    required: "Fill this in.",
    cancel: "Cancel",
    placeOrder: "Create the order",
    placing: "Creating…",
  },
  ar: {
    title: "تحويل إلى طلب",
    description: "سيُنشأ طلب مما كتبه العميل. أكمل البيانات أو صحّحها أولًا.",
    items: "محتويات السلة",
    line: "{name} × {qty}",
    name: "اسم العميل",
    phone: "رقم الهاتف",
    phoneHidden: "جزء من الرقم مخفي. أظهره أو اكتبه كاملًا.",
    reveal: "إظهار الرقم",
    revealHint: "إظهار الرقم يُسجَّل في سجل النشاط",
    governorate: "المحافظة",
    city: "المدينة",
    address: "العنوان",
    required: "املأ هذا الحقل.",
    cancel: "إلغاء",
    placeOrder: "إنشاء الطلب",
    placing: "جارٍ الإنشاء…",
  },
} satisfies Messages;

/**
 * Convert a lost order into an order (POST /checkout-sessions/:id/convert):
 * the basket as the shopper left it, and the name, phone and address to
 * complete or correct. The dialog is the confirmation; the fields and the
 * payload are what they always were. New: the actions are pinned under the
 * form, and a masked number can be shown from here (the audited reveal).
 */
export function LostOrderConvertModal({
  session,
  revealing,
  onReveal,
  onClose,
  onConverted,
}: {
  /** The lost order to convert; null keeps the dialog closed. */
  session: LostOrder | null;
  revealing: boolean;
  onReveal: (session: LostOrder) => Promise<string | null>;
  onClose: () => void;
  onConverted: (session: LostOrder, order: { id: string; orderNumber: string }) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  // What it was about, kept while the dialog closes.
  const shown = useLast(session);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filled when another lost order opens — not when the same one changes under the dialog, or what was typed would go.
  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (!session) return;
    setName(session.customerName ?? "");
    setPhone(session.phone ?? "");
    setProvince(session.shippingAddress?.province ?? "");
    setCity(session.shippingAddress?.city ?? "");
    setAddress(session.shippingAddress?.addressLine ?? "");
    setShowErrors(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const missing = !name.trim() || !phone.trim() || !city.trim() || !address.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (missing) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await lostOrdersConvert(apiClient, workspaceId, session.id, {
        contact: { fullName: name.trim(), phone: phone.trim() },
        shippingAddress: {
          country: session.shippingAddress?.country ?? "EG",
          ...(province.trim() ? { province: province.trim() } : {}),
          city: city.trim(),
          addressLine: address.trim(),
        },
      });
      onConverted(result.session, result.order);
    } catch (err) {
      setError(apiFieldProblems(err)[0]?.message ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function showNumber() {
    if (!session) return;
    const whole = await onReveal(session);
    if (whole) setPhone(whole);
  }

  const need = (value: string) => (showErrors && !value.trim() ? t.required : undefined);
  const items = shown?.items ?? [];
  const currency = shown?.currency ?? "EGP";

  return (
    <Modal
      open={session !== null}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.placing : t.placeOrder}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {items.length > 0 && (
          <ul
            aria-label={t.items}
            data-slot="lost-convert-items"
            className="space-y-1.5 rounded-[0.875rem] bg-paper-sunken px-3.5 py-3 text-sm"
          >
            {items.map((item, i) => (
              <li key={`${item.variantId}-${i}`} className="flex justify-between gap-3">
                <span dir="auto" className="min-w-0 text-ink">
                  {fmt(t.line, { name: item.productName, qty: item.quantity })}
                </span>
                <bdi className="shrink-0 whitespace-nowrap text-ink tabular-nums">{formatMoney(item.lineTotalAmount, currency)}</bdi>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.name} required dir="auto" value={name} onChange={(e) => setName(e.target.value)} error={need(name)} />
          <div>
            <TextField
              label={t.phone}
              required
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={need(phone)}
              hint={isMasked(phone) ? t.phoneHidden : undefined}
            />
            {isMasked(phone) && (
              <button
                type="button"
                title={t.revealHint}
                aria-busy={revealing || undefined}
                onClick={() => {
                  if (!revealing) void showNumber();
                }}
                className={cn(PILL, PILL_LABELLED, PILL_QUIET, "mt-2")}
              >
                {revealing ? (
                  <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <IconEye className="size-4" aria-hidden />
                )}
                {t.reveal}
              </button>
            )}
          </div>
          <TextField label={t.governorate} dir="auto" value={province} onChange={(e) => setProvince(e.target.value)} />
          <TextField label={t.city} required dir="auto" value={city} onChange={(e) => setCity(e.target.value)} error={need(city)} />
        </div>
        <TextField label={t.address} required dir="auto" value={address} onChange={(e) => setAddress(e.target.value)} error={need(address)} />
        {error && <Alert variant="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
