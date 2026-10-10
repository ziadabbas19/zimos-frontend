import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@store-builder/ui";
import {
  carrierBookingOf,
  carrierBookingUpdate,
  type CarrierAutoCreateOn,
  type CarrierBooking,
  type CarrierConnection,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "How {name} books",
    isDefault: "Default courier for this store",
    autoCreateOn: "Book automatically",
    never: "Never — I book each order myself",
    confirmed: "As soon as an order is confirmed",
    paid: "As soon as an order is paid",
    autoHint:
      "Uses the default courier (or the only one set to book on its own). If an order can't be booked — its address isn't in {name}'s list, for example — you get a notification and book it from the order page.",
    allowInspection: "Let the customer open the parcel before accepting it",
    courierNotes: "Notes for the courier",
    courierNotesHint:
      "Printed on every booking unless the order has its own notes.",
    save: "Save",
    saving: "Saving…",
    saved: "{name} booking settings saved.",
  },
  ar: {
    title: "طريقة الحجز مع {name}",
    isDefault: "شركة الشحن الافتراضية للمتجر",
    autoCreateOn: "الحجز التلقائي",
    never: "أبدًا — أحجز كل أوردر بنفسي",
    confirmed: "بمجرد تأكيد الأوردر",
    paid: "بمجرد دفع الأوردر",
    autoHint:
      "يستخدم شركة الشحن الافتراضية (أو الوحيدة المضبوطة على الحجز التلقائي). إذا تعذّر حجز أوردر — مثلًا عنوانه غير موجود في قائمة {name} — يصلك إشعار وتحجزه من صفحة الأوردر.",
    allowInspection: "السماح للعميل بفتح الشحنة قبل الاستلام",
    courierNotes: "ملاحظات للمندوب",
    courierNotesHint: "تُرسل مع كل حجز ما لم يكن للأوردر ملاحظات خاصة به.",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات الحجز مع {name}.",
  },
};

const MOMENTS: CarrierAutoCreateOn[] = ["never", "confirmed", "paid"];

/** Default courier, automatic booking, inspection and courier notes of one connected courier. */
export function CarrierBookingSettings({
  carrierCode,
  name,
  connection,
  onForbidden,
  onChanged,
}: {
  carrierCode: string;
  name: string;
  connection: CarrierConnection;
  onForbidden: (err: unknown) => boolean;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const saved = carrierBookingOf(connection);
  const [draft, setDraft] = useState<CarrierBooking>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh listing (after any change on the page) resets the form to what is stored.
  useEffect(() => setDraft(carrierBookingOf(connection)), [connection]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useReportDirty(dirty);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await carrierBookingUpdate(apiClient, workspaceId, carrierCode, {
        ...draft,
        courierNotes: draft.courierNotes?.trim() || null,
      });
      toast.success(fmt(t.saved, { name }));
      onChanged();
    } catch (err) {
      if (!onForbidden(err)) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-4 border-t border-line pt-4"
    >
      <p className="text-sm font-semibold text-ink">{fmt(t.title, { name })}</p>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={draft.isDefault}
          onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
        />
        {t.isDefault}
      </label>
      <Field label={t.autoCreateOn} hint={fmt(t.autoHint, { name })}>
        {(field) => (
          <Select
            {...field}
            value={draft.autoCreateOn}
            onChange={(e) =>
              setDraft({
                ...draft,
                autoCreateOn: e.target.value as CarrierAutoCreateOn,
              })
            }
          >
            {MOMENTS.map((m) => (
              <option key={m} value={m}>
                {t[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={draft.allowInspection}
          onChange={(e) =>
            setDraft({ ...draft, allowInspection: e.target.checked })
          }
        />
        {t.allowInspection}
      </label>
      <Field label={t.courierNotes} hint={t.courierNotesHint}>
        {(field) => (
          <textarea
            {...field}
            className="min-h-20 w-full rounded-[0.625rem] border border-line bg-paper px-3 py-2 text-sm text-ink"
            maxLength={500}
            value={draft.courierNotes ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, courierNotes: e.target.value })
            }
          />
        )}
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="min-h-11" disabled={busy || !dirty}>
        {busy ? t.saving : t.save}
      </Button>
    </form>
  );
}
