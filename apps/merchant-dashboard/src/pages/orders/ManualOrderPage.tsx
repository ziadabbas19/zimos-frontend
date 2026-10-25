import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  ordersCustomerByPhone,
  ordersManualOptions,
  ordersPreviewDraft,
  type CreateOrderPayload,
  type Offer,
  type OrderDraft,
  type OrderDraftCustomer,
  type OrderDraftPreview,
  type PaymentMethod,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, majorToMinor, variantLabel } from "@/lib/format";
import { getFieldErrors } from "@/lib/errors";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { MoneyInput } from "@/components/MoneyInput";
import { useToast } from "@/components/Toast";
import { useOrderLabels } from "./orderLabels";
import { useOrderErrorMessage } from "./orderErrors";
import { anyHidden, formValue } from "@/components/OrdersLock";

/** A last address worth copying into the form: none of its fields came hidden (locked orders). */
const usableAddress = (address: OrderDraftCustomer["lastAddress"] | undefined): boolean =>
  Boolean(address) && !anyHidden(address?.province, address?.city, address?.addressLine);

const STRINGS = {
  en: {
    title: "Create order",
    description: "An order you take by phone, chat or in person. Prices come from your catalog.",
    back: "Orders",
    customer: "Customer",
    phone: "Mobile number",
    phoneHint: "Type the number to find an existing customer.",
    name: "Full name",
    email: "Email (optional)",
    known: "Existing customer · {orders} orders, {rejected} rejected",
    knownHidden: "Existing customer · their details are hidden until you renew or top up",
    knownBlocked: "This customer is blocked.",
    newCustomer: "New customer",
    useLastAddress: "Use their last address",
    address: "Delivery address",
    governorate: "Governorate",
    chooseGovernorate: "Choose…",
    city: "City / area",
    addressLine: "Address",
    items: "Products",
    product: "Product",
    chooseProduct: "Choose a product…",
    variant: "Variant",
    offer: "Offer",
    noOffer: "No offer — single price",
    quantity: "Quantity",
    add: "Add",
    remove: "Remove {name}",
    noItems: "Add at least one product.",
    payment: "Payment and notes",
    paymentMethod: "Payment method",
    notes: "Notes",
    summary: "Summary",
    coupon: "Discount code",
    shipping: "Shipping",
    shippingAuto: "Calculated from the governorate. Type an amount to set it yourself.",
    shippingPlaceholder: "Automatic",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    total: "Total",
    pricing: "Calculating…",
    addToSee: "Add a product to see the total.",
    create: "Create order",
    creating: "Creating…",
    created: "Order {number} created.",
    required: "This field is required.",
    noProducts: "You have no active products yet.",
  },
  ar: {
    title: "إنشاء أوردر",
    description: "أوردر تأخذه بالهاتف أو الشات أو وجهًا لوجه. الأسعار من الكتالوج.",
    back: "الأوردرات",
    customer: "العميل",
    phone: "رقم الموبايل",
    phoneHint: "اكتب الرقم للبحث عن عميل موجود.",
    name: "الاسم بالكامل",
    email: "البريد الإلكتروني (اختياري)",
    known: "عميل موجود · {orders} أوردر، {rejected} مرفوض",
    knownHidden: "عميل موجود · بياناته مخفية حتى تجدّد الاشتراك أو تشحن الرصيد",
    knownBlocked: "هذا العميل محظور.",
    newCustomer: "عميل جديد",
    useLastAddress: "استخدم آخر عنوان له",
    address: "عنوان التوصيل",
    governorate: "المحافظة",
    chooseGovernorate: "اختر…",
    city: "المدينة / المنطقة",
    addressLine: "العنوان",
    items: "المنتجات",
    product: "المنتج",
    chooseProduct: "اختر منتجًا…",
    variant: "النوع",
    offer: "العرض",
    noOffer: "بدون عرض — السعر العادي",
    quantity: "الكمية",
    add: "إضافة",
    remove: "حذف {name}",
    noItems: "أضف منتجًا واحدًا على الأقل.",
    payment: "الدفع والملاحظات",
    paymentMethod: "طريقة الدفع",
    notes: "ملاحظات",
    summary: "الملخص",
    coupon: "كود الخصم",
    shipping: "الشحن",
    shippingAuto: "يُحسب من المحافظة. اكتب مبلغًا لتحديده بنفسك.",
    shippingPlaceholder: "تلقائي",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    tax: "الضريبة",
    total: "الإجمالي",
    pricing: "جارٍ الحساب…",
    addToSee: "أضف منتجًا لعرض الإجمالي.",
    create: "إنشاء الأوردر",
    creating: "جارٍ الإنشاء…",
    created: "تم إنشاء الأوردر {number}.",
    required: "هذا الحقل مطلوب.",
    noProducts: "لا توجد منتجات نشطة بعد.",
  },
} satisfies Messages;

interface Line {
  key: string;
  variantId: string;
  offerId?: string;
  quantity: number;
  label: string;
}

const PAYMENT_METHODS: PaymentMethod[] = ["cod", "bank_transfer", "card", "wallet"];

/** SPEC §4.5 — the checkout form inside the dashboard, on POST /orders. */
export function ManualOrderPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const labels = useOrderLabels();
  const toast = useToast();
  const navigate = useNavigate();
  const errorMessage = useOrderErrorMessage();
  // Opened from a conversation (inbox "Create order"): ?phone=&name= start the form.
  const [params] = useSearchParams();

  const products = useAsync(
    () => apiClient.listProducts(workspaceId, { status: "active", limit: 200 }).then((r) => r.products),
    [workspaceId]
  );
  const options = useAsync(() => ordersManualOptions(apiClient, workspaceId), [workspaceId]);

  // customer
  const [phone, setPhone] = useState(() => params.get("phone") ?? "");
  const [fullName, setFullName] = useState(() => params.get("name") ?? "");
  const [email, setEmail] = useState("");
  const [customer, setCustomer] = useState<OrderDraftCustomer | null | undefined>(undefined);
  // address
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [addressLine, setAddressLine] = useState("");
  // items
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [offers, setOffers] = useState<Offer[]>([]);
  // payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [notes, setNotes] = useState("");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [shipping, setShipping] = useState("");
  // result
  const [preview, setPreview] = useState<OrderDraftPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const product: Product | undefined = (products.data ?? []).find((p) => p.id === productId);
  const variants = (product?.variants ?? []).filter((v) => v.status === "active");

  // A product's offers load when it is picked; its first variant is preselected.
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

  async function lookup(fillAddress = false) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return setCustomer(undefined);
    try {
      const found = await ordersCustomerByPhone(apiClient, workspaceId, phone.trim());
      setCustomer(found);
      // From a conversation, the name the store has for them beats the WhatsApp profile name —
      // unless it came hidden (locked orders): "••••" never goes into the form.
      const knownName = formValue(found?.fullName);
      if (knownName && (fillAddress || !fullName.trim())) setFullName(knownName);
      const knownEmail = formValue(found?.email);
      if (knownEmail && !email.trim()) setEmail(knownEmail);
      if (fillAddress && usableAddress(found?.lastAddress)) {
        setProvince(found?.lastAddress?.province ?? "");
        setCity(found?.lastAddress?.city ?? "");
        setAddressLine(found?.lastAddress?.addressLine ?? "");
      }
    } catch {
      setCustomer(undefined);
    }
  }

  // A number that came with the link is looked up at once, and the customer's last address filled in.
  useEffect(() => {
    if (!params.get("phone")) return;
    void lookup(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useLastAddress() {
    const last = customer?.lastAddress;
    if (!last || !usableAddress(last)) return;
    setProvince(last.province ?? "");
    setCity(last.city ?? "");
    setAddressLine(last.addressLine ?? "");
  }

  function addLine() {
    const variant = variants.find((v) => v.id === variantId);
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    if (!product || !variant) return;
    const offer = offers.find((o) => o.id === offerId);
    const label = [product.name, variantLabel(variant), offer?.name].filter(Boolean).join(" · ");
    setLines((prev) => [
      ...prev,
      { key: `${Date.now()}-${prev.length}`, variantId: variant.id, offerId: offer?.id, quantity: qty, label },
    ]);
    setQuantity("1");
  }

  const shippingMinor = shipping.trim() === "" ? undefined : majorToMinor(shipping);
  const draft: OrderDraft | null = useMemo(
    () =>
      lines.length === 0
        ? null
        : {
            items: lines.map((l) => ({ variantId: l.variantId, offerId: l.offerId, quantity: l.quantity })),
            shippingAddress: { country: "EG", province: province || undefined, city, addressLine },
            paymentMethod,
            discountCode: appliedCoupon || undefined,
            shippingAmount: shippingMinor,
          },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, province, paymentMethod, appliedCoupon, shippingMinor]
  );

  // The server prices the draft; nothing is computed here.
  useEffect(() => {
    if (!draft) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPricing(true);
    const timer = window.setTimeout(() => {
      ordersPreviewDraft(apiClient, workspaceId, draft)
        .then((p) => {
          if (cancelled) return;
          setPreview(p);
          setPreviewError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setPreview(null);
          setPreviewError(errorMessage(err));
        })
        .finally(() => !cancelled && setPricing(false));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, workspaceId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!phone.trim()) errors.phone = t.required;
    if (!fullName.trim()) errors.fullName = t.required;
    if (!city.trim()) errors.city = t.required;
    if (!addressLine.trim()) errors.addressLine = t.required;
    setFieldErrors(errors);
    if (lines.length === 0) return setFormError(t.noItems);
    if (Object.keys(errors).length > 0) return setFormError(null);

    setSaving(true);
    setFormError(null);
    const payload = {
      items: lines.map((l) => ({ variantId: l.variantId, offerId: l.offerId, quantity: l.quantity })),
      contact: { fullName: fullName.trim(), phone: phone.trim(), email: email.trim() || undefined },
      shippingAddress: { country: "EG", province: province || undefined, city: city.trim(), addressLine: addressLine.trim() },
      paymentMethod,
      discountCode: appliedCoupon || undefined,
      notes: notes.trim() || undefined,
      ...(shippingMinor !== undefined ? { shippingAmount: shippingMinor } : {}),
    } as CreateOrderPayload;
    try {
      const order = await apiClient.createOrder(workspaceId, payload);
      toast.success(fmt(t.created, { number: order.orderNumber }));
      navigate(`/orders/${order.id}`);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors({
        phone: fields["contact.phone"],
        fullName: fields["contact.fullName"],
        city: fields["shippingAddress.city"],
        addressLine: fields["shippingAddress.addressLine"],
      });
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const currency = preview?.currency ?? "EGP";
  const governorates = options.data?.governorates ?? [];

  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/orders", label: t.back }} />

      <DataState loading={products.loading} error={products.error} onRetry={() => products.refresh()}>
        <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <Section title={t.customer}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t.phone}
                  required
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  value={phone}
                  hint={t.phoneHint}
                  error={fieldErrors.phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => void lookup()}
                />
                <TextField
                  label={t.name}
                  required
                  value={fullName}
                  error={fieldErrors.fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <TextField label={t.email} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {customer === null && <p className="mt-3 text-sm text-ink-soft">{t.newCustomer}</p>}
              {customer && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className={customer.isBlacklisted ? "font-medium text-danger" : "text-ink-soft"}>
                    {customer.isBlacklisted
                      ? t.knownBlocked
                      : customer.contactLocked === true || customer.totalOrders === null
                        ? t.knownHidden
                        : fmt(t.known, { orders: customer.totalOrders, rejected: customer.totalRejectedOrders ?? 0 })}
                  </span>
                  {usableAddress(customer.lastAddress) && (
                    <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={useLastAddress}>
                      {t.useLastAddress}
                    </Button>
                  )}
                </div>
              )}
            </Section>

            <Section title={t.address}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.governorate}>
                  {({ id }) => (
                    <Select id={id} value={province} onChange={(e) => setProvince(e.target.value)} className="h-11">
                      <option value="">{t.chooseGovernorate}</option>
                      {province && !governorates.some((g) => `${g.ar} (${g.en})` === province) && (
                        <option value={province}>{province}</option>
                      )}
                      {governorates.map((g) => (
                        <option key={g.code} value={`${g.ar} (${g.en})`}>
                          {locale === "ar" ? g.ar : g.en}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <TextField
                  label={t.city}
                  required
                  value={city}
                  error={fieldErrors.city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <TextField
                className="mt-4"
                label={t.addressLine}
                required
                value={addressLine}
                error={fieldErrors.addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
              />
            </Section>

            <Section title={t.items}>
              {(products.data ?? []).length === 0 ? (
                <p className="text-sm text-ink-soft">{t.noProducts}</p>
              ) : (
                <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_5rem_auto]">
                  <Field label={t.product}>
                    {({ id }) => (
                      <Select id={id} value={productId} onChange={(e) => setProductId(e.target.value)} className="h-11">
                        <option value="">{t.chooseProduct}</option>
                        {(products.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={t.variant}>
                    {({ id }) => (
                      <Select
                        id={id}
                        value={variantId}
                        disabled={!product}
                        onChange={(e) => setVariantId(e.target.value)}
                        className="h-11"
                      >
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {variantLabel(v)} — {formatMoney(v.priceAmount, v.currency)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={t.offer}>
                    {({ id }) => (
                      <Select
                        id={id}
                        value={offerId}
                        disabled={!product || offers.length === 0}
                        onChange={(e) => setOfferId(e.target.value)}
                        className="h-11"
                      >
                        <option value="">{t.noOffer}</option>
                        {offers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.priceAmount ? ` — ${formatMoney(o.priceAmount, o.currency)}` : ""}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={t.quantity}>
                    {({ id }) => (
                      <Input
                        id={id}
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="h-11"
                      />
                    )}
                  </Field>
                  <Button type="button" variant="outline" className="min-h-11" disabled={!variantId} onClick={addLine}>
                    {t.add}
                  </Button>
                </div>
              )}

              {lines.length > 0 && (
                <ul className="mt-4 divide-y divide-line rounded-[0.5rem] border border-line">
                  {lines.map((line, index) => {
                    const priced = preview?.items[index];
                    return (
                      <li key={line.key} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 text-ink">{line.label}</span>
                        <span className="text-ink-soft">× {line.quantity}</span>
                        <span className="w-28 text-end text-ink">
                          {priced ? formatMoney(priced.lineTotalAmount, currency) : "—"}
                        </span>
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
            </Section>

            <Section title={t.payment}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.paymentMethod}>
                  {({ id }) => (
                    <Select
                      id={id}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="h-11"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {labels.paymentMethod(m)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label={t.notes} className="mt-4">
                {({ id }) => (
                  <Textarea id={id} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
                )}
              </Field>
            </Section>
          </div>

          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Section title={t.summary}>
              <div className="space-y-4">
                <TextField
                  label={t.coupon}
                  dir="ltr"
                  value={coupon}
                  maxLength={100}
                  onChange={(e) => setCoupon(e.target.value)}
                  onBlur={() => setAppliedCoupon(coupon.trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setAppliedCoupon(coupon.trim());
                    }
                  }}
                />
                <MoneyInput
                  label={t.shipping}
                  value={shipping}
                  onChange={setShipping}
                  currency={currency}
                  placeholder={t.shippingPlaceholder}
                  hint={t.shippingAuto}
                />

                {previewError && (
                  <Alert variant="danger" role="alert">
                    {previewError}
                  </Alert>
                )}

                {preview ? (
                  <dl className="space-y-2 border-t border-line pt-3 text-sm" aria-busy={pricing || undefined}>
                    <Row label={t.subtotal} value={formatMoney(preview.subtotalAmount, currency)} />
                    {Number(preview.discountAmount) > 0 && (
                      <Row label={t.discount} value={`−${formatMoney(preview.discountAmount, currency)}`} />
                    )}
                    <Row label={t.shipping} value={formatMoney(preview.shippingAmount, currency)} />
                    {Number(preview.taxAmount) > 0 && <Row label={t.tax} value={formatMoney(preview.taxAmount, currency)} />}
                    <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
                      <dt>{t.total}</dt>
                      <dd>{formatMoney(preview.totalAmount, currency)}</dd>
                    </div>
                  </dl>
                ) : (
                  !previewError && <p className="text-sm text-ink-soft">{pricing ? t.pricing : t.addToSee}</p>
                )}

                {formError && (
                  <Alert variant="danger" role="alert">
                    {formError}
                  </Alert>
                )}
                <Button type="submit" className="min-h-11 w-full" disabled={saving}>
                  {saving ? t.creating : t.create}
                </Button>
              </div>
            </Section>
          </div>
        </form>
      </DataState>
    </div>
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
