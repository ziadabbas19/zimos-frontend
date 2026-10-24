import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  courierCreate,
  courierDelete,
  courierUpdate,
  couriersLegacyNames,
  couriersList,
  type Courier,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Your couriers",
    description:
      "For stores that deliver with their own people. Pick a courier when an order goes out; the delivery sheet and cash settlements group by courier.",
    name: "Name",
    phone: "Phone",
    add: "Add courier",
    adding: "Adding…",
    added: "Courier added.",
    linked: "Courier added and linked to {count} earlier orders typed with this name.",
    empty: "No couriers yet.",
    active: "Active",
    inactive: "Off",
    switchOff: "Switch off",
    switchOn: "Switch on",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    remove: "Delete",
    removed: "Courier deleted.",
    legacyTitle: "Names already typed on orders",
    legacyHint: "Add one as a courier to link its earlier orders.",
    legacyAdd: "Add {name} ({count} orders)",
  },
  ar: {
    title: "المندوبون",
    description: "للمتاجر التي توصّل بمندوبيها. اختر المندوب عند خروج الطلب، ويُجمَّع كشف التوصيل وتسويات التحصيل حسب المندوب.",
    name: "الاسم",
    phone: "الهاتف",
    add: "إضافة مندوب",
    adding: "جارٍ الإضافة…",
    added: "تمت إضافة المندوب.",
    linked: "تمت إضافة المندوب وربطه بـ {count} طلبات سابقة كُتب عليها الاسم نفسه.",
    empty: "لا يوجد مندوبون بعد.",
    active: "نشط",
    inactive: "متوقف",
    switchOff: "إيقاف",
    switchOn: "تفعيل",
    edit: "تعديل",
    save: "حفظ",
    cancel: "إلغاء",
    remove: "حذف",
    removed: "تم حذف المندوب.",
    legacyTitle: "أسماء مكتوبة على طلبات سابقة",
    legacyHint: "أضف الاسم كمندوب لربط طلباته السابقة به.",
    legacyAdd: "إضافة {name} ({count} طلبات)",
  },
} satisfies Messages;

/**
 * The store's own couriers (backend modules/couriers): add, rename, switch
 * off, delete one who never carried an order. Saved with shipping.manage and
 * audited server-side.
 */
export function CouriersSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const data = useAsync(
    async () => ({ couriers: await couriersList(apiClient, workspaceId), legacy: await couriersLegacyNames(apiClient, workspaceId) }),
    [workspaceId]
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; phone: string } | null>(null);

  async function run(action: () => Promise<string | null>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const message = await action();
      if (message) toast.success(message);
      await data.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const add = (courierName: string, courierPhone = "") =>
    run(async () => {
      const { linkedShipments } = await courierCreate(apiClient, workspaceId, { name: courierName.trim(), phone: courierPhone.trim() || null });
      setName("");
      setPhone("");
      return linkedShipments > 0 ? fmt(t.linked, { count: linkedShipments }) : t.added;
    });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) void add(name, phone);
  }

  const row = (c: Courier) =>
    editing?.id === c.id ? (
      <li key={c.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextField label={t.name} value={editing.name} maxLength={100} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        <TextField label={t.phone} value={editing.phone} maxLength={32} dir="ltr" onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy || !editing.name.trim()}
            onClick={() =>
              run(async () => {
                await courierUpdate(apiClient, workspaceId, c.id, { name: editing.name.trim(), phone: editing.phone.trim() || null });
                setEditing(null);
                return null;
              })
            }
          >
            {t.save}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
            {t.cancel}
          </Button>
        </div>
      </li>
    ) : (
      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div>
          <p className="text-sm font-medium text-ink">
            {c.name} <span className="text-xs font-normal text-ink-soft">· {c.active ? t.active : t.inactive}</span>
          </p>
          {c.phone && (
            <p className="text-xs text-ink-soft">
              <bdi dir="ltr">{c.phone}</bdi>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing({ id: c.id, name: c.name, phone: c.phone ?? "" })}>
            {t.edit}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run(async () => (await courierUpdate(apiClient, workspaceId, c.id, { active: !c.active }), null))}
          >
            {c.active ? t.switchOff : t.switchOn}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => (await courierDelete(apiClient, workspaceId, c.id), t.removed))}>
            {t.remove}
          </Button>
        </div>
      </li>
    );

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5" data-search-anchor="own-couriers">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextField label={t.name} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <TextField label={t.phone} value={phone} maxLength={32} dir="ltr" inputMode="tel" onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? t.adding : t.add}
        </Button>
      </form>
      <DataState loading={data.loading} error={data.error} empty={false} onRetry={() => data.refresh()}>
        {data.data && (
          <>
            {data.data.couriers.length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">{t.empty}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">{data.data.couriers.map(row)}</ul>
            )}
            {data.data.legacy.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm font-medium text-ink">{t.legacyTitle}</p>
                <p className="text-xs text-ink-soft">{t.legacyHint}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.data.legacy.map((l) => (
                    <Button key={l.name} size="sm" variant="outline" disabled={busy} onClick={() => add(l.name)}>
                      {fmt(t.legacyAdd, { name: l.name, count: l.shipments })}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </DataState>
    </section>
  );
}
