import { useEffect, useId, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  ordersPreviewItems,
  ordersUpdateItems,
  type Offer,
  type Order,
  type OrderItemsPreview,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatOptions, variantLabel } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    button: "Edit items",
    title: "Edit the items of {number}",
    description: "Lines already on the order keep the price they were sold at. Nothing changes until you save.",
    quantity: "Quantity of {name}",
    remove: "Remove {name}",
    addProduct: "Add a product",
    chooseProduct: "Choose a product…",
    noOffer: "No offer",
    add: "Add",
    empty: "An order needs at least one item. To drop the order, cancel it.",
    before: "Total now",
    after: "New total",
    difference: "Difference",
    shipping: "Shipping",
    discount: "Discount",
    pricing: "Calculating…",
    cancel: "Cancel",
    save: "Save items",
    saving: "Saving…",
    saved: "Items updated.",
    ORDER_ALREADY_PAID: "This order has been paid; correct it with a refund instead.",
    ORDER_HAS_COMBO: "This order holds a combo, so its items cannot be edited. Cancel it and place it again.",
    comboLocked: "Holds a combo: cancel and place it again to change its items.",
  },
  ar: {
    button: "تعديل المنتجات",
    title: "تعديل منتجات {number}",
    description: "المنتجات الموجودة في الأوردر تحتفظ بالسعر الذي بيعت به. لا يتغير شيء حتى تحفظ.",
    quantity: "كمية {name}",
    remove: "حذف {name}",
    addProduct: "إضافة منتج",
    chooseProduct: "اختر منتجًا…",
    noOffer: "بدون عرض",
    add: "إضافة",
    empty: "الأوردر يحتاج منتجًا واحدًا على الأقل. لإلغاء الأوردر استخدم الإلغاء.",
    before: "الإجمالي الآن",
    after: "الإجمالي الجديد",
    difference: "الفرق",
    shipping: "الشحن",
    discount: "الخصم",
    pricing: "جارٍ الحساب…",
    cancel: "إلغاء",
    save: "حفظ المنتجات",
    saving: "جارٍ الحفظ…",
    saved: "تم تحديث المنتجات.",
    ORDER_ALREADY_PAID: "تم دفع هذا الأوردر؛ صحّحه باسترداد بدلًا من التعديل.",
    ORDER_HAS_COMBO: "يحتوي هذا الطلب على باقة، لذلك لا يمكن تعديل منتجاته. ألغِه وأنشئه من جديد.",
    comboLocked: "يحتوي على باقة: ألغِه وأنشئه من جديد لتغيير منتجاته.",
  },
} satisfies Messages;

interface Line {
  key: string;
  variantId: string;
  offerId: string | null;
  quantity: number;
  label: string;
}

const SHIPPED = ["fulfilled", "partially_fulfilled", "returned"];

/** Whether the order page should offer the editor at all (the server decides for real). */
export function canEditItems(order: Order): boolean {
  if (order.cancelledAt || order.confirmationState === "rejected") return false;
  if (SHIPPED.includes(order.fulfillmentState)) return false;
  if (Number(order.amountPaid) > 0) return false;
  return !(order.shipments ?? []).some((s) => !["created", "cancelled", "failed"].includes(s.status));
}

/** A combo's lines are priced together, so the server refuses to edit them (409 ORDER_HAS_COMBO). */
function hasComboLines(order: Order): boolean {
  return (order.items ?? []).some((item) => Boolean(item.comboKey));
}

export function EditItemsButton({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  if (!canEditItems(order)) return null;
  // Shown, but off, with the reason beside it: the merchant learns why instead of hunting for it.
  if (hasComboLines(order)) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="min-h-11" disabled aria-describedby={reasonId}>
          {t.button}
        </Button>
        <span id={reasonId} className="text-xs text-ink-soft">
          {t.comboLocked}
        </span>
      </span>
    );
  }
  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
        {t.button}
      </Button>
      {open && (
        <EditItemsDialog
          order={order}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function EditItemsDialog({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const orderError = useOrderErrorMessage();
  const errorMessage = (err: unknown) => {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    if (code === "ORDER_HAS_COMBO") return t.ORDER_HAS_COMBO;
    return code === "ORDER_ALREADY_PAID" ? t.ORDER_ALREADY_PAID : orderError(err);
  };

  const [lines, setLines] = useState<Line[]>(() =>
    order.items
      .filter((i) => i.variantId)
      .map((i) => ({
        key: i.id,
        variantId: i.variantId as string,
        offerId: i.offerId ?? null,
        quantity: i.quantity,
        label: [i.productNameSnapshot, formatOptions(i.variantOptionsSnapshot), i.offerNameSnapshot].filter(Boolean).join(" · "),
      }))
  );
  const [preview, setPreview] = useState<OrderItemsPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const [saving, setSaving] = useState(false);

  // add-a-product row
  const products = useAsync(
    () => apiClient.listProducts(workspaceId, { status: "active", limit: 200 }).then((r) => r.products),
    [workspaceId]
  );
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const product = (products.data ?? []).find((p) => p.id === productId);
  const variants = (product?.variants ?? []).filter((v) => v.status === "active");

  useEffect(() => {
    setOfferId("");
    setOffers([]);
    if (!product) return;
    setVariantId(variants[0]?.id ?? "");
    let cancelled = false;
    apiClient
      .listOffers(workspaceId, product.id)
      .then((list) => !cancelled && setOffers(list.filter((o) => o.status === "active")))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const payload = useMemo(
    () => lines.map((l) => ({ variantId: l.variantId, ...(l.offerId ? { offerId: l.offerId } : {}), quantity: l.quantity })),
    [lines]
  );

  // The server prices every change; the dialog only shows its answer.
  useEffect(() => {
    if (payload.length === 0) {
      setPreview(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setPricing(true);
    const timer = window.setTimeout(() => {
      ordersPreviewItems(apiClient, workspaceId, order.id, payload)
        .then((p) => {
          if (cancelled) return;
          setPreview(p);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setPreview(null);
          setError(errorMessage(err));
        })
        .finally(() => !cancelled && setPricing(false));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, workspaceId, order.id]);

  function addLine() {
    const variant = variants.find((v) => v.id === variantId);
    if (!product || !variant) return;
    const offer = offers.find((o) => o.id === offerId);
    const same = lines.find((l) => l.variantId === variant.id && (l.offerId ?? "") === (offer?.id ?? ""));
    if (same) {
      setLines((prev) => prev.map((l) => (l.key === same.key ? { ...l, quantity: l.quantity + 1 } : l)));
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        variantId: variant.id,
        offerId: offer?.id ?? null,
        quantity: 1,
        label: [product.name, variantLabel(variant), offer?.name].filter(Boolean).join(" · "),
      },
    ]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await ordersUpdateItems(apiClient, workspaceId, order.id, payload);
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const money = (n: string) => formatMoney(n, preview?.currency ?? order.currency);
  const diff = preview ? Number(preview.differenceAmount) : 0;

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={fmt(t.title, { number: order.orderNumber })}
      description={t.description}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button className="min-h-11" onClick={save} disabled={saving || pricing || !preview || lines.length === 0}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}

        {lines.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-[0.5rem] border border-line">
            {lines.map((line, index) => {
              const priced = preview?.items.find(
                (i) => i.variantId === line.variantId && (i.offerId ?? "") === (line.offerId ?? "")
              );
              return (
                <li key={line.key} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-ink">{line.label}</span>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    aria-label={fmt(t.quantity, { name: line.label })}
                    onChange={(e) => {
                      const quantity = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      setLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity } : l)));
                    }}
                    className="h-11 w-20"
                  />
                  <span className="w-28 text-end text-ink">{priced ? money(priced.lineTotalAmount) : "—"}</span>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    aria-label={fmt(t.remove, { name: line.label })}
                    className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.addProduct}</legend>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_auto]">
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-11" aria-label={t.addProduct}>
              <option value="">{t.chooseProduct}</option>
              {(products.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={variantId} disabled={!product} onChange={(e) => setVariantId(e.target.value)} className="h-11">
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {variantLabel(v)} — {formatMoney(v.priceAmount, v.currency)}
                </option>
              ))}
            </Select>
            <Select
              value={offerId}
              disabled={!product || offers.length === 0}
              onChange={(e) => setOfferId(e.target.value)}
              className="h-11"
            >
              <option value="">{t.noOffer}</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <Button type="button" variant="outline" className="min-h-11" disabled={!variantId} onClick={addLine}>
              {t.add}
            </Button>
          </div>
        </fieldset>

        {preview ? (
          <dl className="space-y-1.5 border-t border-line pt-3 text-sm" aria-busy={pricing || undefined}>
            <Row label={t.before} value={money(preview.before.totalAmount)} />
            <Row label={t.shipping} value={money(preview.after.shippingAmount)} />
            {Number(preview.after.discountAmount) > 0 && (
              <Row label={t.discount} value={`−${money(preview.after.discountAmount)}`} />
            )}
            <div className="flex justify-between text-base font-semibold text-ink">
              <dt>{t.after}</dt>
              <dd>{money(preview.after.totalAmount)}</dd>
            </div>
            <div className={`flex justify-between ${diff > 0 ? "text-accent-dark" : diff < 0 ? "text-success" : "text-ink-soft"}`}>
              <dt>{t.difference}</dt>
              <dd>
                <bdi dir="ltr">
                  {diff > 0 ? "+" : diff < 0 ? "−" : ""}
                  {money(String(Math.abs(diff)))}
                </bdi>
              </dd>
            </div>
          </dl>
        ) : (
          pricing && <p className="text-sm text-ink-soft">{t.pricing}</p>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
