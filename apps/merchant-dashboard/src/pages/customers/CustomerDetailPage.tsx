import { useState, type FormEvent } from "react";
import {
  CUSTOMER_REFERRALS_ENABLED,
  EMAIL_SUPPRESSIONS_ENABLED,
  LOYALTY_ENABLED,
  STORE_CREDIT_ENABLED,
  STORE_REPORTS_ENABLED,
  VIP_TIERS_ENABLED,
} from "@/lib/features";
import { CustomerRfmCard } from "./crm/CustomerRfmCard";
import { CustomerInvitesCard } from "@/pages/customerReferrals/CustomerInvitesCard";
import { CustomerLoyaltyCard } from "@/pages/loyalty/CustomerLoyaltyCard";
import { CustomerStoreCreditCard } from "@/pages/storeCredit/CustomerStoreCreditCard";
import { CustomerVipCard } from "@/pages/vipTiers/CustomerVipCard";
import { CustomerSuppressionBanner } from "./suppressions/CustomerSuppressionBanner";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Input } from "@store-builder/ui";
import type { Customer, CustomerAddress, Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { ContactInsights } from "./ContactInsights";
import { formValue } from "@/components/OrdersLock";

const STRINGS = {
  en: {
    customer: "Customer",
    back: "Contacts",
    summary: "{orders} orders · reliability {score}",
    ordersTitle: "Orders",
    ordersDescription: "Every order this customer has placed, newest first.",
    ordersEmpty: "No orders from this customer yet.",
    ordersIncomplete: "Only the store’s first 1,000 orders were searched, so this list may be incomplete.",
    confLabel: "Conf",
    shipLabel: "Ship",
    // Order states, worded in English exactly as humanize() prints them.
    conf_pending: "Pending",
    conf_confirmed: "Confirmed",
    conf_rejected: "Rejected",
    conf_unreachable: "Unreachable",
    conf_postponed: "Postponed",
    ful_unfulfilled: "Unfulfilled",
    ful_partially_fulfilled: "Partially fulfilled",
    ful_fulfilled: "Fulfilled",
    ful_returned: "Returned",
    contactDetails: "Contact details",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    phoneHint: "Set from the storefront / checkout — read-only here.",
    alternatePhone: "Alternate phone",
    marketingConsent: "Has consented to marketing",
    customerUpdated: "Customer updated.",
    blacklistTitle: "Blacklist",
    blacklisted: "This customer is blacklisted.",
    blacklistedReason: "This customer is blacklisted — {reason}.",
    removeFromBlacklist: "Remove from blacklist",
    blacklistNote: "Blacklisting stops this customer from checking out.",
    blacklistCustomer: "Blacklist customer",
    blacklistConfirmTitle: "Blacklist this customer?",
    blacklistConfirmDescription: "They won't be able to check out until you remove them from the blacklist.",
    blacklistConfirm: "Blacklist",
    working: "Working…",
    reason: "Reason",
    reasonPlaceholder: "Repeated failed deliveries",
    reasonRequired: "Enter a reason for blacklisting this customer.",
    customerBlacklisted: "Customer blacklisted.",
    unblacklistTitle: "Remove from blacklist?",
    unblacklistDescription: "The customer will be able to place orders again.",
    remove: "Remove",
    customerUnblacklisted: "Customer removed from the blacklist.",
    addressesTitle: "Addresses",
    addAddress: "Add address",
    lockedNote: "This customer's details are hidden: every order they placed is locked. They can be edited, blacklisted or given an address once you renew or top up.",
    noAddresses: "No addresses on file.",
    defaultBadge: "Default",
    editAddress: "Edit address",
    addressSaved: "Address saved.",
    addressAdded: "Address added.",
    country: "Country",
    countryHint: "Two-letter code.",
    province: "Province",
    city: "City",
    postalCode: "Postal code",
    addressLine: "Address line",
    notes: "Notes",
    defaultAddress: "Default address",
    saveAddress: "Save address",
  },
  ar: {
    customer: "عميل",
    back: "جهات الاتصال",
    summary: "عدد الطلبات: {orders} · درجة الموثوقية: {score}",
    ordersTitle: "الطلبات",
    ordersDescription: "كل طلبات هذا العميل، الأحدث أولًا.",
    ordersEmpty: "لا توجد طلبات من هذا العميل بعد.",
    ordersIncomplete: "تم البحث في أول 1,000 طلب في المتجر فقط، لذلك قد تكون هذه القائمة غير مكتملة.",
    confLabel: "التأكيد",
    shipLabel: "الشحن",
    conf_pending: "في انتظار المكالمة",
    conf_confirmed: "مؤكد",
    conf_rejected: "مرفوض",
    conf_unreachable: "لم يتم الوصول إليه",
    conf_postponed: "مؤجل",
    ful_unfulfilled: "لم يُشحن",
    ful_partially_fulfilled: "شُحن جزئيًا",
    ful_fulfilled: "مكتمل",
    ful_returned: "مرتجع",
    contactDetails: "بيانات التواصل",
    fullName: "الاسم بالكامل",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    phoneHint: "يأتي من المتجر عند إتمام الطلب، ولا يمكن تعديله من هنا.",
    alternatePhone: "هاتف بديل",
    marketingConsent: "وافق على استقبال رسائل تسويقية",
    customerUpdated: "تم تحديث بيانات العميل.",
    blacklistTitle: "الحظر",
    blacklisted: "هذا العميل محظور.",
    blacklistedReason: "هذا العميل محظور — {reason}.",
    removeFromBlacklist: "إلغاء الحظر",
    blacklistNote: "الحظر يمنع هذا العميل من إتمام أي طلب.",
    blacklistCustomer: "حظر العميل",
    blacklistConfirmTitle: "حظر هذا العميل؟",
    blacklistConfirmDescription: "لن يتمكن من إتمام أي طلب حتى تلغي حظره.",
    blacklistConfirm: "حظر",
    working: "جارٍ التنفيذ…",
    reason: "السبب",
    reasonPlaceholder: "فشل التوصيل أكثر من مرة",
    reasonRequired: "اكتب سبب حظر هذا العميل.",
    customerBlacklisted: "تم حظر العميل.",
    unblacklistTitle: "إلغاء حظر العميل؟",
    unblacklistDescription: "سيتمكن العميل من الطلب مرة أخرى.",
    remove: "إلغاء الحظر",
    customerUnblacklisted: "تم إلغاء حظر العميل.",
    addressesTitle: "العناوين",
    addAddress: "إضافة عنوان",
    lockedNote: "بيانات هذا العميل مخفية لأن كل طلباته مقفلة. يمكن تعديلها أو حظره أو إضافة عنوان له بعد تجديد الاشتراك أو شحن الرصيد.",
    noAddresses: "لا توجد عناوين مسجّلة.",
    defaultBadge: "الافتراضي",
    editAddress: "تعديل العنوان",
    addressSaved: "تم حفظ العنوان.",
    addressAdded: "تمت إضافة العنوان.",
    country: "الدولة",
    countryHint: "رمز من حرفين.",
    province: "المحافظة",
    city: "المدينة",
    postalCode: "الرمز البريدي",
    addressLine: "العنوان",
    notes: "ملاحظات",
    defaultAddress: "العنوان الافتراضي",
    saveAddress: "حفظ العنوان",
  },
} satisfies Messages;

export function CustomerDetailPage() {
  const t = useT(STRINGS);
  const { customerId } = useParams<{ customerId: string }>();
  const workspaceId = useWorkspaceId();
  const detail = useAsync(
    () => apiClient.getCustomer(workspaceId, customerId as string),
    [workspaceId, customerId]
  );
  const customer = detail.data;
  const reload = () => detail.refresh({ silent: true });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={
          customer
            ? customer.fullName || customer.phoneRaw || customer.phoneNormalized
            : t.customer
        }
        back={{ to: "/customers", label: t.back }}
        description={
          customer
            ? fmt(t.summary, { orders: customer.totalOrders, score: customer.reliabilityScore })
            : undefined
        }
      />

      <DataState loading={detail.loading} error={detail.error} onRetry={() => detail.refresh()}>
        {customer && (
          <div className="space-y-6">
            <ContactInsights customerId={customer.id} />
            {/* No email reaches this address: it bounced, or the customer marked one as spam (lib/features). */}
            {EMAIL_SUPPRESSIONS_ENABLED && <CustomerSuppressionBanner email={customer.email} />}
            {/* The customer's credit, points, level and invites, each only while its programme is switched on (lib/features). */}
            {STORE_CREDIT_ENABLED && <CustomerStoreCreditCard customerId={customer.id} />}
            {LOYALTY_ENABLED && <CustomerLoyaltyCard customerId={customer.id} />}
            {VIP_TIERS_ENABLED && <CustomerVipCard customerId={customer.id} />}
            {CUSTOMER_REFERRALS_ENABLED && <CustomerInvitesCard customerId={customer.id} />}
            {/* The customer's RFM group: how recently, how often and how much they buy (lib/features). */}
            {STORE_REPORTS_ENABLED && <CustomerRfmCard customerId={customer.id} />}
            {/* A hidden customer (locked orders): no form that would write "••••" over their details. */}
            {customer.contactLocked === true ? (
              <p role="note" className="rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft p-4 text-sm text-ink">
                {t.lockedNote}
              </p>
            ) : (
              <ContactForm customer={customer} onSaved={reload} />
            )}
            <OrderHistorySection customer={customer} />
            {customer.contactLocked !== true && <BlacklistSection customer={customer} onChanged={reload} />}
            <AddressesSection customer={customer} onChanged={reload} />
          </div>
        )}
      </DataState>
    </div>
  );
}

const HISTORY_PAGE_SIZE = 50;
const HISTORY_MAX_PAGES = 20;

/**
 * The customer's orders, newest first.
 *
 * The API has no per-customer order list: a customer response carries no
 * orders, and GET /orders filters only by state (paging by id, not date). So
 * this pages through the store's orders and keeps this customer's, stopping as
 * soon as it has found `totalOrders` of them — or after 1,000 orders, in which
 * case it says the list may be incomplete. A customer with no orders costs no
 * request at all.
 */
function OrderHistorySection({ customer }: { customer: Customer }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const history = useAsync(async () => {
    const found: Order[] = [];
    if (customer.totalOrders === 0) return { orders: found, complete: true };
    let cursor: string | undefined;
    for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
      const { orders, nextCursor } = await apiClient.listOrders(workspaceId, {
        limit: HISTORY_PAGE_SIZE,
        cursor,
      });
      found.push(...orders.filter((order) => order.customerId === customer.id));
      if (!nextCursor || found.length >= customer.totalOrders) {
        found.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { orders: found, complete: true };
      }
      cursor = nextCursor;
    }
    found.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { orders: found, complete: false };
  }, [workspaceId, customer.id, customer.totalOrders]);

  const orders = history.data?.orders ?? [];

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.ordersTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.ordersDescription}</p>

      <div className="mt-4">
        <DataState
          loading={history.loading}
          error={history.error}
          empty={orders.length === 0}
          emptyMessage={t.ordersEmpty}
          onRetry={() => history.refresh()}
        >
          <ul className="divide-y divide-line overflow-hidden rounded-[0.5rem] border border-line">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link to={`/orders/${order.id}`} className="text-sm font-medium text-primary hover:underline">
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-ink-soft">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={t.confLabel} value={order.confirmationState} text={t[`conf_${order.confirmationState}`]} />
                  <StatusBadge label={t.shipLabel} value={order.fulfillmentState} text={t[`ful_${order.fulfillmentState}`]} />
                  <span className="text-sm font-medium text-ink">
                    {formatMoney(order.totalAmount, order.currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </DataState>
        {history.data && !history.data.complete && (
          <p className="mt-2 text-xs text-ink-soft">
            {t.ordersIncomplete}
          </p>
        )}
      </div>
    </section>
  );
}

function ContactForm({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [fullName, setFullName] = useState(formValue(customer.fullName));
  const [email, setEmail] = useState(formValue(customer.email));
  const [alternatePhone, setAlternatePhone] = useState(formValue(customer.alternatePhone));
  const [marketingConsent, setMarketingConsent] = useState(customer.marketingConsent);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await apiClient.updateCustomer(workspaceId, customer.id, {
        fullName: fullName.trim() || null,
        email: email.trim() || null,
        alternatePhone: alternatePhone.trim() || null,
        marketingConsent,
      });
      toast.success(t.customerUpdated);
      onSaved();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.contactDetails}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.fullName}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.fullName}
          />
          <TextField
            label={t.email}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Field label={t.phone} hint={t.phoneHint}>
            {({ id }) => (
              <Input id={id} value={customer.phoneRaw || customer.phoneNormalized} disabled />
            )}
          </Field>
          <TextField
            label={t.alternatePhone}
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(e.target.value)}
            error={fieldErrors.alternatePhone}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
          />
          {t.marketingConsent}
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? common.saving : common.save}
          </Button>
        </div>
      </form>
    </section>
  );
}

function BlacklistSection({
  customer,
  onChanged,
}: {
  customer: Customer;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [blacklisting, setBlacklisting] = useState(false);
  const [unblacklisting, setUnblacklisting] = useState(false);
  const [reason, setReason] = useState("");

  async function confirmBlacklist() {
    if (reason.trim() === "") throw new Error(t.reasonRequired);
    await apiClient.setCustomerBlacklist(workspaceId, customer.id, {
      isBlacklisted: true,
      reason: reason.trim(),
    });
    toast.success(t.customerBlacklisted);
    setBlacklisting(false);
    setReason("");
    onChanged();
  }

  async function confirmRemove() {
    await apiClient.setCustomerBlacklist(workspaceId, customer.id, { isBlacklisted: false });
    toast.success(t.customerUnblacklisted);
    setUnblacklisting(false);
    onChanged();
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.blacklistTitle}</h2>
      {customer.isBlacklisted ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-soft">
            {customer.blacklistReason
              ? fmt(t.blacklistedReason, { reason: customer.blacklistReason })
              : t.blacklisted}
          </p>
          <Button variant="outline" size="sm" onClick={() => setUnblacklisting(true)}>
            {t.removeFromBlacklist}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-soft">
            {t.blacklistNote}
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setReason("");
              setBlacklisting(true);
            }}
          >
            {t.blacklistCustomer}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={blacklisting}
        title={t.blacklistConfirmTitle}
        description={t.blacklistConfirmDescription}
        confirmLabel={t.blacklistConfirm}
        cancelLabel={common.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setBlacklisting(false)}
        onConfirm={confirmBlacklist}
      >
        <Field label={t.reason} required>
          {({ id }) => (
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.reasonPlaceholder}
            />
          )}
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={unblacklisting}
        title={t.unblacklistTitle}
        description={t.unblacklistDescription}
        confirmLabel={t.remove}
        cancelLabel={common.cancel}
        busyLabel={t.working}
        onCancel={() => setUnblacklisting(false)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}

function AddressesSection({
  customer,
  onChanged,
}: {
  customer: Customer;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const [target, setTarget] = useState<CustomerAddress | "new" | null>(null);
  const addresses = customer.addresses ?? [];
  // A hidden customer's addresses show hidden and are not edited (the API refuses it too).
  const editable = customer.contactLocked !== true;

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-medium text-ink">{t.addressesTitle}</h2>
        {editable && (
          <Button size="sm" onClick={() => setTarget("new")}>
            {t.addAddress}
          </Button>
        )}
      </div>

      {addresses.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t.noAddresses}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[0.5rem] border border-line p-3"
            >
              <div className="min-w-0 text-sm">
                <p className="text-ink">
                  {[a.addressLine, a.city, a.province, a.postalCode, a.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {a.notes && <p className="text-xs text-ink-soft">{a.notes}</p>}
                {a.isDefault && <p className="text-xs text-primary">{t.defaultBadge}</p>}
              </div>
              {editable && (
                <Button size="sm" variant="ghost" onClick={() => setTarget(a)}>
                  {common.edit}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target === "new" ? t.addAddress : t.editAddress}
      >
        {target !== null && (
          <AddressForm
            key={target === "new" ? "new" : target.id}
            customerId={customer.id}
            address={target === "new" ? undefined : target}
            onCancel={() => setTarget(null)}
            onDone={() => {
              setTarget(null);
              onChanged();
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function AddressForm({
  customerId,
  address,
  onDone,
  onCancel,
}: {
  customerId: string;
  address?: CustomerAddress;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [country, setCountry] = useState(address?.country ?? "EG");
  const [province, setProvince] = useState(formValue(address?.province));
  const [city, setCity] = useState(formValue(address?.city));
  const [addressLine, setAddressLine] = useState(formValue(address?.addressLine));
  const [postalCode, setPostalCode] = useState(formValue(address?.postalCode));
  const [notes, setNotes] = useState(formValue(address?.notes));
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      if (address) {
        await apiClient.updateCustomerAddress(workspaceId, customerId, address.id, {
          country: country.trim().toUpperCase(),
          province: province.trim() || null,
          city: city.trim(),
          addressLine: addressLine.trim(),
          postalCode: postalCode.trim() || null,
          notes: notes.trim() || null,
          isDefault,
        });
        toast.success(t.addressSaved);
      } else {
        await apiClient.addCustomerAddress(workspaceId, customerId, {
          country: country.trim().toUpperCase(),
          province: province.trim() || undefined,
          city: city.trim(),
          addressLine: addressLine.trim(),
          postalCode: postalCode.trim() || undefined,
          notes: notes.trim() || undefined,
          isDefault,
        });
        toast.success(t.addressAdded);
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.country}
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors.country}
          hint={t.countryHint}
        />
        <TextField
          label={t.province}
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          error={fieldErrors.province}
        />
        <TextField
          label={t.city}
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={fieldErrors.city}
        />
        <TextField
          label={t.postalCode}
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          error={fieldErrors.postalCode}
        />
      </div>
      <TextField
        label={t.addressLine}
        required
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        error={fieldErrors.addressLine}
      />
      <Field label={t.notes} error={fieldErrors.notes}>
        {({ id }) => (
          <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        {t.defaultAddress}
      </label>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {common.cancel}
        </Button>
        <Button
          type="submit"
          disabled={saving || !country.trim() || !city.trim() || !addressLine.trim()}
        >
          {saving ? common.saving : address ? t.saveAddress : t.addAddress}
        </Button>
      </div>
    </form>
  );
}
