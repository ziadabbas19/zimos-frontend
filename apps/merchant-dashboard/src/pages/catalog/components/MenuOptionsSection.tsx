import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { menuOptionsGet, menuOptionsSave, type MenuOptionGroup } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { useToast } from "@/components/Toast";
import { ORDER_PAYLOAD_OPTIONS_ENABLED } from "@/lib/features";

const STRINGS = {
  en: {
    title: "Menu options",
    description:
      "For food and drinks: groups such as Size or Extras, each choice with the price it adds. The customer picks them on the product page; the price is always worked out by the server.",
    addGroup: "Add group",
    groupName: "Group name (e.g. Size)",
    required: "Required",
    min: "Pick at least",
    max: "Pick at most",
    active: "Shown",
    choiceName: "Choice",
    choicePrice: "Adds",
    choiceCode: "Till code",
    addChoice: "Add choice",
    removeChoice: "Remove choice",
    removeGroup: "Remove group",
    up: "Move up",
    down: "Move down",
    save: "Save menu options",
    saving: "Saving…",
    saved: "Menu options saved.",
    empty: "No option groups. The product sells as it is.",
    invalid: "Every group needs a name and at least one named choice; at least ≤ at most; prices 0 or more.",
  },
  ar: {
    title: "خيارات المنيو",
    description: "للأكل والمشروبات: مجموعات مثل الحجم أو الإضافات، ولكل اختيار السعر الذي يضيفه. يختارها العميل في صفحة المنتج، ويحسب الخادم السعر دائمًا.",
    addGroup: "إضافة مجموعة",
    groupName: "اسم المجموعة (مثال: الحجم)",
    required: "إجباري",
    min: "أقل عدد",
    max: "أقصى عدد",
    active: "ظاهر",
    choiceName: "الاختيار",
    choicePrice: "يضيف",
    choiceCode: "الكود في نظام الكاشير",
    addChoice: "إضافة اختيار",
    removeChoice: "حذف الاختيار",
    removeGroup: "حذف المجموعة",
    up: "نقل لأعلى",
    down: "نقل لأسفل",
    save: "حفظ خيارات المنيو",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ خيارات المنيو.",
    empty: "لا توجد مجموعات خيارات. يُباع المنتج كما هو.",
    invalid: "كل مجموعة تحتاج اسمًا واختيارًا واحدًا على الأقل له اسم، وأقل عدد ≤ أقصى عدد، والأسعار 0 أو أكثر.",
  },
} satisfies Messages;

interface DraftChoice {
  id?: string;
  name: string;
  price: string;
  active: boolean;
  /** The till's code (ORDER_PAYLOAD_OPTIONS_ENABLED); "" = none. */
  externalCode: string;
}
interface DraftGroup {
  id?: string;
  name: string;
  required: boolean;
  min: string;
  max: string;
  active: boolean;
  choices: DraftChoice[];
}

const toDraft = (groups: MenuOptionGroup[]): DraftGroup[] =>
  groups.map((g) => ({
    id: g.id,
    name: g.name,
    required: g.required,
    min: String(g.minSelect),
    max: String(g.maxSelect),
    active: g.active,
    choices: g.choices.map((c) => ({ id: c.id, name: c.name, price: minorToMajorInput(c.priceDeltaAmount), active: c.active, externalCode: c.externalCode ?? "" })),
  }));

function fromDraft(groups: DraftGroup[]): MenuOptionGroup[] | null {
  const out: MenuOptionGroup[] = [];
  for (const g of groups) {
    const min = Number(g.min || "0");
    const max = Number(g.max || "1");
    if (!g.name.trim() || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max) return null;
    const choices = [];
    for (const c of g.choices) {
      const price = majorToMinor(c.price || "0");
      if (!c.name.trim() || !Number.isFinite(price) || price < 0) return null;
      choices.push({
        ...(c.id ? { id: c.id } : {}),
        name: c.name.trim(),
        priceDeltaAmount: price,
        active: c.active,
        // Sent only while the field is shown: left out, the server keeps the stored code.
        ...(ORDER_PAYLOAD_OPTIONS_ENABLED ? { externalCode: c.externalCode.trim() || null } : {}),
      });
    }
    if (choices.length === 0) return null;
    out.push({ ...(g.id ? { id: g.id } : {}), name: g.name.trim(), required: g.required, minSelect: min, maxSelect: max, active: g.active, choices });
  }
  return out;
}

const NEW_CHOICE: DraftChoice = { name: "", price: "", active: true, externalCode: "" };
const NEW_GROUP: DraftGroup = { name: "", required: false, min: "0", max: "1", active: true, choices: [{ ...NEW_CHOICE }] };

/** A product's menu options (backend catalog/menuOptions.js), saved as a whole; products.manage, audited. */
export function MenuOptionsSection({ productId }: { productId: string }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const data = useAsync(() => menuOptionsGet(apiClient, workspaceId, productId), [workspaceId, productId]);
  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      <DataState loading={data.loading} error={data.error} empty={false} onRetry={() => data.refresh()}>
        {data.data && <Editor key={JSON.stringify(data.data)} productId={productId} initial={toDraft(data.data)} onSaved={() => data.refresh()} />}
      </DataState>
    </section>
  );
}

function Editor({ productId, initial, onSaved }: { productId: string; initial: DraftGroup[]; onSaved: () => unknown }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [groups, setGroups] = useState<DraftGroup[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setGroup = (gi: number, patch: Partial<DraftGroup>) => setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setChoice = (gi: number, ci: number, patch: Partial<DraftChoice>) =>
    setGroup(gi, { choices: groups[gi].choices.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  const move = (gi: number, by: number) =>
    setGroups((prev) => {
      const next = [...prev];
      const [g] = next.splice(gi, 1);
      next.splice(gi + by, 0, g);
      return next;
    });

  async function save() {
    const payload = fromDraft(groups);
    if (!payload) return setError(t.invalid);
    setSaving(true);
    setError(null);
    try {
      await menuOptionsSave(apiClient, workspaceId, productId, payload);
      toast.success(t.saved);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      {groups.length === 0 && <p className="text-sm text-ink-soft">{t.empty}</p>}
      {groups.map((g, gi) => (
        <div key={g.id ?? `new-${gi}`} className="space-y-3 rounded-md border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <TextField label={t.groupName} value={g.name} maxLength={100} onChange={(e) => setGroup(gi, { name: e.target.value })} />
            <TextField label={t.min} value={g.min} inputMode="numeric" dir="ltr" maxLength={2} onChange={(e) => setGroup(gi, { min: e.target.value })} />
            <TextField label={t.max} value={g.max} inputMode="numeric" dir="ltr" maxLength={2} onChange={(e) => setGroup(gi, { max: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={g.required} onChange={(e) => setGroup(gi, { required: e.target.checked, min: e.target.checked && g.min === "0" ? "1" : g.min })} />
              {t.required}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={g.active} onChange={(e) => setGroup(gi, { active: e.target.checked })} />
              {t.active}
            </label>
            <div className="ms-auto flex gap-2">
              <Button size="sm" variant="outline" disabled={gi === 0} aria-label={t.up} onClick={() => move(gi, -1)}>
                ↑
              </Button>
              <Button size="sm" variant="outline" disabled={gi === groups.length - 1} aria-label={t.down} onClick={() => move(gi, 1)}>
                ↓
              </Button>
              <Button size="sm" variant="outline" onClick={() => setGroups((prev) => prev.filter((_, i) => i !== gi))}>
                {t.removeGroup}
              </Button>
            </div>
          </div>
          <ul className="space-y-2">
            {g.choices.map((c, ci) => (
              <li
                key={c.id ?? `new-${ci}`}
                className={ORDER_PAYLOAD_OPTIONS_ENABLED ? "grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto_auto]" : "grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto_auto]"}
              >
                <TextField label={t.choiceName} value={c.name} maxLength={100} onChange={(e) => setChoice(gi, ci, { name: e.target.value })} />
                <MoneyInput label={t.choicePrice} value={c.price} onChange={(v) => setChoice(gi, ci, { price: v })} />
                {ORDER_PAYLOAD_OPTIONS_ENABLED && (
                  <TextField label={t.choiceCode} value={c.externalCode} dir="ltr" maxLength={120} onChange={(e) => setChoice(gi, ci, { externalCode: e.target.value })} />
                )}
                <label className="flex h-11 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={c.active} onChange={(e) => setChoice(gi, ci, { active: e.target.checked })} />
                  {t.active}
                </label>
                <Button size="sm" variant="ghost" disabled={g.choices.length === 1} onClick={() => setGroup(gi, { choices: g.choices.filter((_, i) => i !== ci) })}>
                  {t.removeChoice}
                </Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" onClick={() => setGroup(gi, { choices: [...g.choices, { ...NEW_CHOICE }] })}>
            {t.addChoice}
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline" onClick={() => setGroups((prev) => [...prev, { ...NEW_GROUP, choices: [...NEW_GROUP.choices] }])}>
          {t.addGroup}
        </Button>
        <Button disabled={saving} onClick={save}>
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </div>
  );
}
