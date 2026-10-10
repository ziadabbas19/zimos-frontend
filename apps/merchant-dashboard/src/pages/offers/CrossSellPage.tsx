import { useRef, useState } from "react";
import { IconDelete, IconEdit, IconPlus, IconPower, IconShuffle } from "@/components/icons";
import { Button, Label } from "@store-builder/ui";
import {
  CROSS_SELL_PLACEMENTS,
  offersDeleteCrossSell,
  offersListCrossSell,
  offersSaveCrossSell,
  type CrossSellPlacement,
  type CrossSellRule,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { Select } from "@/components/Select";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { ProductChecklist, useStoreProducts } from "./OfferRuleParts";
import { OfferNumbers, useOfferStats } from "./OfferNumbers";
import { FormProblem, OfferList, OfferListState, OfferPage, OfferPreview, OfferRow, SheetActions, TOUCH_BUTTON, TOUCH_FIELD, focusFirstInvalid } from "./OfferKit";

/**
 * Cross-sell rules: "with these products, suggest those". With no
 * rule that fits, the store suggests what real orders show was bought
 * together — so the screen works empty, and a rule only overrides it.
 */

const STRINGS = {
  en: {
    title: "Cross-sell",
    description: "Suggest products that go with what the customer is buying. Without a rule, your store suggests what past orders show was bought together.",
    newRule: "New rule",
    listLabel: "Your cross-sell rules",
    emptyTitle: "No cross-sell rules yet",
    emptyHint: "Your store already suggests what customers bought together. Add a rule to choose the suggestions yourself.",
    place_cart: "In the cart",
    place_checkout: "At checkout",
    place_thank_you: "On the thank-you page",
    when: "With {names}",
    whenAny: "With any product",
    suggests: "Suggests {names}",
    listJoin: ", ",
    more: "{names} +{count} more",
    createTitle: "New cross-sell rule",
    editTitle: "Edit cross-sell rule",
    name: "Rule name",
    namePlaceholder: "Accessories with phones",
    triggers: "When the cart has any of",
    triggersHint: "Leave empty to suggest with every cart.",
    suggestions: "Suggest these products",
    placement: "Where",
    maxItems: "How many to show",
    maxItemsHint: "From 1 to 8.",
    nameRequired: "Write a name for the rule, so you can tell it from the others.",
    suggestionsRequired: "Tick at least one product to suggest.",
    previewWith: "{place}, with {names} the shopper is offered {suggested}.",
    previewAny: "{place}, every shopper is offered {suggested}.",
    previewNone: "Tick the products to suggest and the sentence shows here.",
    edit: "Edit",
    turnOn: "Turn on",
    turnOff: "Turn off",
    turnedOn: "“{name}” is on.",
    turnedOff: "“{name}” is off.",
    saved: "Saved.",
    delete: "Delete",
    deleted: "“{name}” was deleted.",
    deleteTitle: "Delete “{name}”?",
    deleteHint: "Your store goes back to suggesting what customers bought together.",
  },
  ar: {
    title: "منتجات مقترحة",
    description: "اقترح منتجات تناسب ما يشتريه العميل. بدون قاعدة، يقترح متجرك ما اشتراه العملاء معًا في الطلبات السابقة.",
    newRule: "قاعدة جديدة",
    listLabel: "قواعد الاقتراح لديك",
    emptyTitle: "لا توجد قواعد بعد",
    emptyHint: "متجرك يقترح بالفعل ما اشتراه العملاء معًا. أضف قاعدة لتختار الاقتراحات بنفسك.",
    place_cart: "في السلة",
    place_checkout: "عند إتمام الطلب",
    place_thank_you: "في صفحة الشكر",
    when: "مع {names}",
    whenAny: "مع أي منتج",
    suggests: "يقترح {names}",
    listJoin: "، ",
    more: "{names} +{count} أخرى",
    createTitle: "قاعدة اقتراح جديدة",
    editTitle: "تعديل قاعدة الاقتراح",
    name: "اسم القاعدة",
    namePlaceholder: "إكسسوارات مع الهواتف",
    triggers: "عندما تحتوي السلة على أي من",
    triggersHint: "اتركها فارغة للاقتراح مع كل سلة.",
    suggestions: "اقترح هذه المنتجات",
    placement: "المكان",
    maxItems: "عدد المنتجات المعروضة",
    maxItemsHint: "من 1 إلى 8.",
    nameRequired: "اكتب اسمًا للقاعدة لتميّزها عن غيرها.",
    suggestionsRequired: "حدّد منتجًا واحدًا على الأقل للاقتراح.",
    previewWith: "{place}، مع {names} يُعرض على العميل {suggested}.",
    previewAny: "{place}، يُعرض على كل عميل {suggested}.",
    previewNone: "حدّد المنتجات المقترحة لتظهر الجملة هنا.",
    edit: "تعديل",
    turnOn: "تفعيل",
    turnOff: "إيقاف",
    turnedOn: "تم تفعيل «{name}».",
    turnedOff: "تم إيقاف «{name}».",
    saved: "تم الحفظ.",
    delete: "حذف",
    deleted: "تم حذف «{name}».",
    deleteTitle: "حذف «{name}»؟",
    deleteHint: "سيعود متجرك إلى اقتراح ما اشتراه العملاء معًا.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

function names(ids: string[], products: Product[], t: Strings): string {
  const found = ids.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean) as string[];
  const shown = found.slice(0, 3).join(t.listJoin);
  return found.length > 3 ? fmt(t.more, { names: shown, count: found.length - 3 }) : shown;
}

export function CrossSellPage() {
  // Each offer's views, acceptances and added revenue.
  const stats = useOfferStats();
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // Shown at once from the session's copy on the way back from the hub, and read again behind it.
  const list = useCachedAsync(`offer-cross-sell:${workspaceId}`, () => offersListCrossSell(apiClient, workspaceId), [workspaceId]);
  const products = useStoreProducts();
  const [editing, setEditing] = useState<CrossSellRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<CrossSellRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rules = list.data ?? [];
  const all = products.data ?? [];

  /** The switch moves at once; a refusal puts it back and says why. Undo is the opposite save. */
  async function setActive(rule: CrossSellRule, isActive: boolean, undoable = true): Promise<void> {
    const { id, ...payload } = rule;
    setBusyId(id);
    list.setData((prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, isActive } : r)));
    try {
      await offersSaveCrossSell(apiClient, workspaceId, id, { ...payload, isActive });
      const said = fmt(isActive ? t.turnedOn : t.turnedOff, { name: rule.name });
      if (undoable) toast.undo(said, () => setActive(rule, !isActive, false));
      else toast.success(said);
      void list.refresh({ silent: true });
    } catch (err) {
      list.setData((prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, isActive: !isActive } : r)));
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const newButton = (
    <Button type="button" className={TOUCH_BUTTON} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" aria-hidden />
      {t.newRule}
    </Button>
  );

  const menuFor = (rule: CrossSellRule): ContextMenuItem[] => [
    { id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing(rule) },
    { id: "toggle", label: rule.isActive ? t.turnOff : t.turnOn, icon: IconPower, onSelect: () => void setActive(rule, !rule.isActive) },
    { id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(rule) },
  ];

  return (
    <OfferPage title={t.title} description={t.description} primaryAction={rules.length > 0 ? newButton : undefined}>
      <OfferListState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} rows={3}>
        {rules.length === 0 ? (
          <EmptyState icon={<IconShuffle />} title={t.emptyTitle} description={t.emptyHint} action={newButton} />
        ) : (
          <OfferList label={t.listLabel}>
            {rules.map((rule) => (
              <OfferRow
                key={rule.id}
                name={rule.name}
                line={<bdi>{fmt(t.suggests, { names: names(rule.offerProductIds, all, t) })}</bdi>}
                details={
                  <>
                    <span>
                      <bdi>{rule.triggerProductIds.length > 0 ? fmt(t.when, { names: names(rule.triggerProductIds, all, t) }) : t.whenAny}</bdi>
                    </span>
                    <span>{t[`place_${rule.placement}`]}</span>
                    <OfferNumbers stat={stats?.crossSell[rule.id]} />
                  </>
                }
                onOpen={() => setEditing(rule)}
                toggle={{ checked: rule.isActive, busy: busyId === rule.id, onChange: (next) => void setActive(rule, next) }}
                menu={menuFor(rule)}
              />
            ))}
          </OfferList>
        )}
      </OfferListState>


      {editing && (
        <CrossSellDialog
          rule={editing === "new" ? null : editing}
          products={all}
          productsLoading={products.loading}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void list.refresh({ silent: true });
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.deleteHint}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await offersDeleteCrossSell(apiClient, workspaceId, deleting.id);
          toast.success(fmt(t.deleted, { name: deleting.name }));
          setDeleting(null);
          void list.refresh({ silent: true });
        }}
      />
    </OfferPage>
  );
}

function CrossSellDialog({
  rule,
  products,
  productsLoading,
  onClose,
  onSaved,
}: {
  rule: CrossSellRule | null;
  /** A new rule that pins suggestions on this product's page. */
  products: Product[];
  productsLoading: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(rule?.name ?? "");
  const [triggers, setTriggers] = useState<string[]>(rule?.triggerProductIds ?? []);
  const [suggestions, setSuggestions] = useState<string[]>(rule?.offerProductIds ?? []);
  const [placement, setPlacement] = useState<CrossSellPlacement>(rule?.placement ?? "cart");
  const [maxItems, setMaxItems] = useState(String(rule?.maxItems ?? 4));
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const missingName = !name.trim();
    const missingSuggestions = suggestions.length === 0;
    setNameError(missingName ? t.nameRequired : null);
    setSuggestionsError(missingSuggestions ? t.suggestionsRequired : null);
    if (missingName || missingSuggestions) {
      if (missingName) focusFirstInvalid(formRef.current);
      else formRef.current?.querySelector<HTMLElement>("[data-field='suggestions']")?.scrollIntoView({ block: "center" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await offersSaveCrossSell(apiClient, workspaceId, rule?.id ?? null, {
        name: name.trim(),
        triggerProductIds: triggers,
        triggerCollectionIds: rule?.triggerCollectionIds ?? [],
        offerProductIds: suggestions,
        placement,
        maxItems: Math.min(8, Math.max(1, Number.parseInt(maxItems, 10) || 4)),
        isActive: rule?.isActive ?? true,
      });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const suggested = names(suggestions, products, t);
  const place = t[`place_${placement}`];

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={rule ? t.editTitle : t.createTitle}
      className="max-w-2xl"
      footer={<SheetActions busy={busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <div ref={formRef} className="space-y-4">
        <TextField
          label={t.name}
          required
          maxLength={120}
          placeholder={t.namePlaceholder}
          value={name}
          disabled={busy}
          error={nameError ?? undefined}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cross-placement">{t.placement}</Label>
            <Select
              id="cross-placement"
              className={TOUCH_FIELD}
              value={placement}
              disabled={busy}
              onChange={(e) => setPlacement(e.target.value as CrossSellPlacement)}
            >
              {CROSS_SELL_PLACEMENTS.map((p) => (
                <option key={p} value={p}>
                  {t[`place_${p}`]}
                </option>
              ))}
            </Select>
          </div>
          <TextField
            label={t.maxItems}
            hint={t.maxItemsHint}
            type="number"
            inputMode="numeric"
            min={1}
            max={8}
            dir="ltr"
            value={maxItems}
            disabled={busy}
            onChange={(e) => setMaxItems(e.target.value)}
          />
        </div>
        <ProductChecklist
          label={t.triggers}
          hint={t.triggersHint}
          products={products}
          value={triggers}
          onChange={setTriggers}
          disabled={busy}
          max={100}
          loading={productsLoading}
        />
        <div data-field="suggestions" className="space-y-1.5">
          <ProductChecklist
            label={t.suggestions}
            products={products}
            value={suggestions}
            onChange={(ids) => {
              setSuggestions(ids);
              setSuggestionsError(null);
            }}
            disabled={busy}
            max={20}
            loading={productsLoading}
          />
          {suggestionsError && (
            <p role="alert" className="text-xs font-medium text-danger">
              {suggestionsError}
            </p>
          )}
        </div>

        <OfferPreview>
          {suggested ? (
            <p>
              <bdi>
                {triggers.length > 0
                  ? fmt(t.previewWith, { place, names: names(triggers, products, t), suggested })
                  : fmt(t.previewAny, { place, suggested })}
              </bdi>
            </p>
          ) : (
            <p className="text-ink-soft">{t.previewNone}</p>
          )}
        </OfferPreview>

        <FormProblem>{error}</FormProblem>
      </div>
    </Modal>
  );
}
