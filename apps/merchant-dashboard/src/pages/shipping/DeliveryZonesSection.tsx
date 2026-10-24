import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  deliveryZoneCreate,
  deliveryZoneDelete,
  deliveryZoneUpdate,
  deliveryZonesList,
  deliveryZonesReorder,
  type DeliveryZone,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Delivery zones",
    description:
      "Areas inside your city, each with its own delivery fee, an optional minimum order and an estimated time. While on, the customer picks their area at checkout and pays its fee.",
    useZones: "Price delivery by these zones at checkout",
    name: "Area name",
    fee: "Delivery fee",
    minimum: "Minimum order (optional)",
    eta: "Estimated minutes (optional)",
    add: "Add zone",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    up: "Move up",
    down: "Move down",
    switchOff: "Switch off",
    switchOn: "Switch on",
    remove: "Delete",
    off: "Off",
    empty: "No zones yet. Add the areas you deliver to.",
    summary: "Fee {fee} · minimum {minimum} · {eta}",
    noMinimum: "none",
    minutes: "{n} min",
    noEta: "no time set",
    invalid: "Enter a name, a fee of 0 or more, and minutes between 1 and 1440.",
    saved: "Saved.",
  },
  ar: {
    title: "مناطق التوصيل",
    description:
      "مناطق داخل مدينتك، لكل منها رسوم توصيل وحد أدنى اختياري للطلب ووقت تقديري. عند التفعيل يختار العميل منطقته عند الدفع ويدفع رسومها.",
    useZones: "احتساب التوصيل حسب هذه المناطق عند الدفع",
    name: "اسم المنطقة",
    fee: "رسوم التوصيل",
    minimum: "الحد الأدنى للطلب (اختياري)",
    eta: "الوقت التقديري بالدقائق (اختياري)",
    add: "إضافة منطقة",
    save: "حفظ",
    cancel: "إلغاء",
    edit: "تعديل",
    up: "نقل لأعلى",
    down: "نقل لأسفل",
    switchOff: "إيقاف",
    switchOn: "تفعيل",
    remove: "حذف",
    off: "متوقفة",
    empty: "لا توجد مناطق بعد. أضف المناطق التي توصّل إليها.",
    summary: "الرسوم {fee} · الحد الأدنى {minimum} · {eta}",
    noMinimum: "لا يوجد",
    minutes: "{n} دقيقة",
    noEta: "بدون وقت محدد",
    invalid: "أدخل اسمًا ورسومًا تساوي 0 أو أكثر، ودقائق بين 1 و1440.",
    saved: "تم الحفظ.",
  },
} satisfies Messages;

interface Draft {
  name: string;
  fee: string;
  minimum: string;
  eta: string;
}

const EMPTY: Draft = { name: "", fee: "", minimum: "", eta: "" };

/** A draft as the API wants it, or null when something is off. */
function toInput(d: Draft) {
  const fee = majorToMinor(d.fee || "0");
  const minimum = d.minimum.trim() ? majorToMinor(d.minimum) : null;
  const eta = d.eta.trim() ? Number(d.eta) : null;
  if (!d.name.trim() || !Number.isFinite(fee) || fee < 0) return null;
  if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) return null;
  if (eta !== null && (!Number.isInteger(eta) || eta < 1 || eta > 1440)) return null;
  return { name: d.name.trim(), feeAmount: fee, minOrderAmount: minimum, etaMinutes: eta };
}

/**
 * The store's delivery zones (backend shipping/deliveryZones.js): add, edit,
 * reorder, switch off, delete; and whether checkout prices by them (the
 * shipping setting deliveryZonesEnabled). shipping.manage, audited.
 */
export function DeliveryZonesSection({ currency }: { currency: string }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const data = useAsync(
    async () => ({
      zones: await deliveryZonesList(apiClient, workspaceId),
      enabled: Boolean((await apiClient.getShippingSettings(workspaceId)).settings.deliveryZonesEnabled),
    }),
    [workspaceId]
  );
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, message: string | null = null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      if (message) toast.success(message);
      await data.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const input = toInput(draft);
    if (!input) return setError(t.invalid);
    void run(async () => {
      await deliveryZoneCreate(apiClient, workspaceId, input);
      setDraft(EMPTY);
    });
  }

  const move = (zones: DeliveryZone[], index: number, by: number) => {
    const ids = zones.map((z) => z.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved);
    return run(() => deliveryZonesReorder(apiClient, workspaceId, ids));
  };

  const fields = (d: Draft, set: (d: Draft) => void) => (
    <>
      <TextField label={t.name} value={d.name} maxLength={100} onChange={(e) => set({ ...d, name: e.target.value })} />
      <MoneyInput label={t.fee} value={d.fee} onChange={(v) => set({ ...d, fee: v })} />
      <MoneyInput label={t.minimum} value={d.minimum} onChange={(v) => set({ ...d, minimum: v })} />
      <TextField label={t.eta} value={d.eta} inputMode="numeric" dir="ltr" maxLength={4} onChange={(e) => set({ ...d, eta: e.target.value })} />
    </>
  );

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5" data-search-anchor="delivery-zones">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}
      <DataState loading={data.loading} error={data.error} empty={false} onRetry={() => data.refresh()}>
        {data.data && (
          <>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={data.data.enabled}
                disabled={busy}
                onChange={(e) =>
                  run(() => apiClient.updateShippingSettings(workspaceId, { deliveryZonesEnabled: e.target.checked }), t.saved)
                }
              />
              {t.useZones}
            </label>

            {data.data.zones.length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">{t.empty}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {data.data.zones.map((z, index, zones) =>
                  editing?.id === z.id ? (
                    <li key={z.id} className="grid gap-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
                      {fields(editing.draft, (d) => setEditing({ id: z.id, draft: d }))}
                      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            const input = toInput(editing.draft);
                            if (!input) return setError(t.invalid);
                            void run(async () => {
                              await deliveryZoneUpdate(apiClient, workspaceId, z.id, input);
                              setEditing(null);
                            });
                          }}
                        >
                          {t.save}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                          {t.cancel}
                        </Button>
                      </div>
                    </li>
                  ) : (
                    <li key={z.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {z.name} {!z.active && <span className="text-xs font-normal text-ink-soft">· {t.off}</span>}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {fmt(t.summary, {
                            fee: formatMoney(z.feeAmount, currency),
                            minimum: z.minOrderAmount === null ? t.noMinimum : formatMoney(z.minOrderAmount, currency),
                            eta: z.etaMinutes ? fmt(t.minutes, { n: z.etaMinutes }) : t.noEta,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={busy || index === 0} aria-label={t.up} onClick={() => move(zones, index, -1)}>
                          ↑
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy || index === zones.length - 1} aria-label={t.down} onClick={() => move(zones, index, 1)}>
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setEditing({
                              id: z.id,
                              draft: {
                                name: z.name,
                                fee: minorToMajorInput(z.feeAmount),
                                minimum: minorToMajorInput(z.minOrderAmount),
                                eta: z.etaMinutes ? String(z.etaMinutes) : "",
                              },
                            })
                          }
                        >
                          {t.edit}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => deliveryZoneUpdate(apiClient, workspaceId, z.id, { active: !z.active }))}>
                          {z.active ? t.switchOff : t.switchOn}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => deliveryZoneDelete(apiClient, workspaceId, z.id))}>
                          {t.remove}
                        </Button>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}

            <form onSubmit={add} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
              {fields(draft, setDraft)}
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={busy || !draft.name.trim()}>
                  {t.add}
                </Button>
              </div>
            </form>
          </>
        )}
      </DataState>
    </section>
  );
}
