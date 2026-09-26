import { useId, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { ManualCancelShipment } from "@store-builder/api-client";
import { getErrorMessage } from "@/lib/errors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";

const STRINGS = {
  en: {
    title: "Cancel it in {carrier}'s dashboard first",
    intro:
      "{carrier} can't cancel deliveries from here. Before you continue, cancel {count} in your {carrier} dashboard, or the courier may still collect and deliver the parcel.",
    one: "this delivery",
    many: "these deliveries",
    waybill: "Tracking no.",
    noWaybill: "no tracking number",
    after:
      "After you confirm, they're marked cancelled here. We check with {carrier} again over the next few days, and if it still shows the parcel moving, the order is flagged.",
    acknowledge: "I've cancelled {count} in the {carrier} dashboard.",
    confirm: "Confirm and continue",
    working: "Working…",
    back: "Go back",
    separator: ", ",
  },
  ar: {
    title: "ألغِها من لوحة تحكم {carrier} أولًا",
    intro:
      "لا يمكن إلغاء شحنات {carrier} من هنا. قبل المتابعة، ألغِ {count} من لوحة تحكم {carrier}، وإلا فقد يستلم المندوب الطرد ويوصّله.",
    one: "هذه الشحنة",
    many: "هذه الشحنات",
    waybill: "رقم التتبع",
    noWaybill: "بدون رقم تتبع",
    after:
      "بعد التأكيد، ستُعلَّم كملغاة هنا. سنراجع حالتها مع {carrier} خلال الأيام القليلة القادمة، وإذا ظل الطرد يتحرك لديهم فسيتم تمييز الأوردر بعلامة.",
    acknowledge: "ألغيت {count} من لوحة تحكم {carrier}.",
    confirm: "تأكيد ومتابعة",
    working: "جارٍ التنفيذ…",
    back: "رجوع",
    separator: "، ",
  },
} satisfies Messages;

/** The couriers the shipments belong to, in first-seen order ("Bosta" / "Bosta, Aramex"). */
function carrierNames(shipments: ManualCancelShipment[], separator: string): string {
  return [...new Set(shipments.map((s) => s.carrierName || s.carrierCode))].join(separator);
}

interface Props {
  shipments: ManualCancelShipment[] | null;
  /** Nothing changes: the refused request stays refused. */
  onCancel: () => void;
  /** Resend the same request with acknowledgeManualCancel. Throw to stay open with the message. */
  onConfirm: () => Promise<unknown>;
}

/**
 * The 409 CARRIER_MANUAL_CANCEL_REQUIRED step: the courier has no cancel
 * API, so the merchant cancels the listed bookings in the courier's own
 * dashboard and says so explicitly before the request is repeated.
 */
export function ManualCancelDialog({ shipments, onCancel, onConfirm }: Props) {
  const t = useT(STRINGS);
  const checkboxId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = shipments ?? [];
  const carrier = carrierNames(list, t.separator);
  const count = list.length === 1 ? t.one : t.many;
  const say = (template: string) => fmt(template, { carrier, count });

  function close() {
    if (busy) return;
    setAcknowledged(false);
    setError(null);
    onCancel();
  }

  async function confirm() {
    if (!acknowledged) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setAcknowledged(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={shipments !== null}
      onClose={close}
      title={say(t.title)}
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={close} disabled={busy}>
            {t.back}
          </Button>
          <Button variant="danger" className="min-h-11" onClick={confirm} disabled={busy || !acknowledged}>
            {busy ? t.working : t.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {error && <Alert variant="danger">{error}</Alert>}
        <p className="text-ink">{say(t.intro)}</p>
        <ul className="space-y-1.5 rounded-[0.5rem] border border-line px-3 py-2">
          {list.map((s) => (
            <li key={s.shipmentId} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-ink">{s.carrierName || s.carrierCode}</span>
              <span className="text-ink-soft">
                {s.waybillNumber ? (
                  <>
                    {t.waybill}{" "}
                    <bdi dir="ltr" className="font-medium text-ink">
                      {s.waybillNumber}
                    </bdi>
                  </>
                ) : (
                  t.noWaybill
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-ink-soft">{say(t.after)}</p>
        <label
          htmlFor={checkboxId}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-3 py-2.5 text-accent-dark"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={acknowledged}
            disabled={busy}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="font-medium">{say(t.acknowledge)}</span>
        </label>
      </div>
    </Modal>
  );
}
