import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Ban, MapPin, Pencil, UserRound } from "lucide-react";
import { Button } from "@store-builder/ui";
import { ordersUpdateContact, protectionAddBlocked, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useOrderErrorMessage } from "../orderErrors";
import { formValue } from "@/components/OrdersLock";

const STRINGS = {
  en: {
    copyPhone: "Copy number",
    customerPage: "Customer & past orders",
    block: "Block number",
    blockTitle: "Block {phone}?",
    blockDescription: "Orders from this number will be refused (or flagged, if your protection rules say so). You can unblock it under Fraud protection.",
    blockConfirm: "Block",
    blocked: "{phone} is blocked.",
    blockReason: "Blocked from order {number}",
    edit: "Edit",
    editTitle: "Customer details on this order",
    editHint: "Fixes a typo before the order ships. The customer's own profile is not changed.",
    fullName: "Name",
    phone: "Phone",
    altPhone: "Second phone",
    email: "Email",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    keep: "Keep",
    working: "Working…",
    saved: "Customer details saved.",
    copyAddress: "Copy address",
    map: "View on map",
  },
  ar: {
    copyPhone: "نسخ الرقم",
    customerPage: "العميل وطلباته السابقة",
    block: "حظر الرقم",
    blockTitle: "حظر {phone}؟",
    blockDescription: "ستُرفض الطلبات من هذا الرقم (أو تُميَّز إذا كانت قواعد الحماية تقول ذلك). يمكنك إلغاء الحظر من صفحة الحماية من الاحتيال.",
    blockConfirm: "حظر",
    blocked: "تم حظر {phone}.",
    blockReason: "حُظر من الطلب {number}",
    edit: "تعديل",
    editTitle: "بيانات العميل في هذا الطلب",
    editHint: "لتصحيح خطأ قبل شحن الطلب. لا يتغير ملف العميل نفسه.",
    fullName: "الاسم",
    phone: "الهاتف",
    altPhone: "هاتف آخر",
    email: "البريد الإلكتروني",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    keep: "إبقاء",
    working: "جارٍ التنفيذ…",
    saved: "تم حفظ بيانات العميل.",
    copyAddress: "نسخ العنوان",
    map: "عرض على الخريطة",
  },
} satisfies Messages;

const toolClass = "min-h-11 rounded-md border border-line bg-paper-raised px-3 text-sm";

/** Under the customer on the order page: copy, the customer's page, block, edit (SPEC §4.4 card 6). */
export function OrderContactTools({ order, onChanged }: { order: Order; onChanged?: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const [blocking, setBlocking] = useState(false);
  const [editing, setEditing] = useState(false);
  const phone = order.contactSnapshot?.phone ?? "";

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {phone && <CopyButton value={phone} label={t.copyPhone} className={toolClass} />}
      {order.customerId && (
        <Link to={`/customers/${order.customerId}`} className={`${toolClass} inline-flex items-center gap-1.5 text-ink hover:text-primary`}>
          <UserRound className="size-4" aria-hidden />
          {t.customerPage}
        </Link>
      )}
      {onChanged && (
        <Button variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={() => setEditing(true)}>
          <Pencil className="size-4" aria-hidden />
          {t.edit}
        </Button>
      )}
      {phone && (
        <Button variant="outline" size="sm" className="min-h-11 gap-1.5 text-danger" onClick={() => setBlocking(true)}>
          <Ban className="size-4" aria-hidden />
          {t.block}
        </Button>
      )}
      <ConfirmDialog
        open={blocking}
        title={fmt(t.blockTitle, { phone })}
        description={t.blockDescription}
        confirmLabel={t.blockConfirm}
        cancelLabel={t.keep}
        busyLabel={t.working}
        destructive
        onCancel={() => setBlocking(false)}
        onConfirm={async () => {
          try {
            await protectionAddBlocked(apiClient, workspaceId, {
              type: "phone",
              value: phone,
              scopes: ["orders"],
              reason: fmt(t.blockReason, { number: order.orderNumber }),
            });
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          toast.success(fmt(t.blocked, { phone }));
          setBlocking(false);
        }}
      />
      {editing && onChanged && (
        <EditContactDialog
          order={order}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function EditContactDialog({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const c = order.contactSnapshot ?? { fullName: "", phone: "" };
  // The page offers no edit on a locked order; a hidden value still never starts a field.
  const [fullName, setFullName] = useState(formValue(c.fullName));
  const [phone, setPhone] = useState(formValue(c.phone));
  const [altPhone, setAltPhone] = useState(formValue(c.alternatePhone));
  const [email, setEmail] = useState(formValue(c.email));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ordersUpdateContact(apiClient, workspaceId, order.id, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        alternatePhone: altPhone.trim() || null,
        email: email.trim() || null,
      });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={t.editTitle} description={t.editHint}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <TextField label={t.fullName} required value={fullName} maxLength={200} onChange={(e) => setFullName(e.target.value)} />
        <TextField label={t.phone} required dir="ltr" inputMode="tel" value={phone} maxLength={32} onChange={(e) => setPhone(e.target.value)} />
        <TextField label={t.altPhone} dir="ltr" inputMode="tel" value={altPhone} maxLength={32} onChange={(e) => setAltPhone(e.target.value)} />
        <TextField label={t.email} dir="ltr" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" className="min-h-11" disabled={busy || !fullName.trim() || !phone.trim()}>
            {busy ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Under the shipping address: copy it, or open it on a map (SPEC §4.4 card 7). */
export function OrderAddressTools({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const a = order.shippingAddressSnapshot;
  if (!a) return null;
  const text = [a.addressLine, a.city, a.province, a.country].filter(Boolean).join("، ");
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <CopyButton value={text} label={t.copyAddress} className={toolClass} />
      <a href={map} target="_blank" rel="noopener noreferrer" className={`${toolClass} inline-flex items-center gap-1.5 text-ink hover:text-primary`}>
        <MapPin className="size-4" aria-hidden />
        {t.map}
      </a>
    </div>
  );
}
