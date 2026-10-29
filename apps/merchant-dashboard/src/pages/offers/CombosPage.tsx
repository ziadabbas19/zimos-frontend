import { useState } from "react";
import { IconArchive, IconEdit, IconPackage, IconPlus } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { combosArchive, combosList, type ComboDto } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { formatMoney, formatOptions } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ComboEditorDialog } from "./ComboEditorDialog";
import { OfferList, OfferListState, OfferPage, OfferRow, TOUCH_BUTTON } from "./OfferKit";

/**
 * Product combos (/offers/combos, PRODUCT_COMBOS_ENABLED): different products
 * sold together at one price. Each row says what is in the combo, what its
 * products cost apart and what the combo costs, whether it is live, and
 * whether it can be bought at all. A row opens the combo's sheet; «…» holds
 * edit and archive. Reading needs products.view; creating, editing and
 * archiving need products.manage, so a role without it sees the list only.
 */

const STRINGS = {
  en: {
    title: "Combos",
    description: "Different products sold together at one price.",
    newCombo: "New combo",
    listLabel: "Your combos",
    emptyTitle: "No combos yet",
    emptyDescription:
      "A combo puts different products together at one price — a phone with its case and charger, or a meal with its drink. The customer adds the whole combo in one tap, and each product leaves its own stock.",
    status_draft: "Draft",
    status_active: "Active",
    status_archived: "Archived",
    unavailable: "Unavailable",
    unavailableHint: "A product in it is no longer for sale, so the store does not sell it.",
    itemQty: "{item} × {q}",
    itemPick: "{name} (the customer picks)",
    itemOption: "{name} ({option})",
    productGone: "A deleted product",
    itemJoin: " + ",
    apart: "Apart:",
    combo: "Combo:",
    saves: "Saves {amount}",
    edit: "Edit",
    archive: "Archive",
    archiveTitle: "Archive “{name}”?",
    archiveHint: "It leaves the store at once and can no longer be bought. Orders already placed keep its name.",
    archived: "“{name}” was archived.",
  },
  ar: {
    title: "باقات المنتجات",
    description: "منتجات مختلفة تُباع معًا بسعر واحد.",
    newCombo: "باقة جديدة",
    listLabel: "باقاتك",
    emptyTitle: "لا توجد باقات منتجات بعد",
    emptyDescription:
      "الباقة تجمع منتجات مختلفة بسعر واحد — هاتف مع غطائه وشاحنه، أو وجبة مع مشروبها. يضيف العميل الباقة كاملة بضغطة واحدة، ويُخصم كل منتج من مخزونه.",
    status_draft: "مسودة",
    status_active: "مفعّلة",
    status_archived: "مؤرشفة",
    unavailable: "غير متاحة",
    unavailableHint: "أحد منتجاتها لم يعد متاحًا للبيع، لذلك لا يبيعها المتجر.",
    itemQty: "{item} × {q}",
    itemPick: "{name} (يختار العميل)",
    itemOption: "{name} ({option})",
    productGone: "منتج محذوف",
    itemJoin: " + ",
    apart: "منفصلة:",
    combo: "الباقة:",
    saves: "توفير {amount}",
    edit: "تعديل",
    archive: "أرشفة",
    archiveTitle: "أرشفة «{name}»؟",
    archiveHint: "تختفي من المتجر فورًا ولا يمكن شراؤها بعد ذلك. الطلبات التي تمت بها تحتفظ باسمها.",
    archived: "تمت أرشفة «{name}».",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** «Mug (Red) × 2 + T-shirt (the customer picks) × 1». */
function itemsText(combo: ComboDto, t: Strings): string {
  return combo.items
    .map((item) => {
      const name = item.productName ?? t.productGone;
      const option = formatOptions(item.variantOptions);
      const label = item.pickVariant ? fmt(t.itemPick, { name }) : option ? fmt(t.itemOption, { name, option }) : name;
      return fmt(t.itemQty, { item: label, q: item.quantity });
    })
    .join(t.itemJoin);
}

export function CombosPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const { currentWorkspace } = useWorkspace();
  const canManage = hasPermission(currentWorkspace?.permissions, "products.manage");
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  // Shown at once from the session's copy on the way back from the hub, and read again behind it.
  const list = useCachedAsync(`offer-combos:${workspaceId}`, () => combosList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<ComboDto | "new" | null>(null);
  const [archiving, setArchiving] = useState<ComboDto | null>(null);
  const combos = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  const newButton = canManage ? (
    <Button type="button" className={TOUCH_BUTTON} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" aria-hidden />
      {t.newCombo}
    </Button>
  ) : undefined;

  const menuFor = (combo: ComboDto): ContextMenuItem[] =>
    canManage
      ? [
          { id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing(combo) },
          { id: "archive", label: t.archive, icon: IconArchive, destructive: true, separatorBefore: true, onSelect: () => setArchiving(combo) },
        ]
      : [];

  return (
    <OfferPage title={t.title} description={t.description} primaryAction={combos.length > 0 ? newButton : undefined}>
      <OfferListState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {combos.length === 0 ? (
          <EmptyState icon={<IconPackage />} title={t.emptyTitle} description={t.emptyDescription} action={newButton} />
        ) : (
          <OfferList label={t.listLabel}>
            {combos.map((combo) => {
              const saving = Math.max(0, combo.price.full - combo.price.total);
              return (
                <OfferRow
                  key={combo.id}
                  name={combo.name}
                  leading={combo.imageUrl ? <img src={combo.imageUrl} alt="" className="size-full object-cover" /> : <IconPackage />}
                  badge={
                    <>
                      <StatusBadge value={combo.status} text={t[`status_${combo.status}`]} />
                      {!combo.available && <StatusBadge value="unavailable" tone="danger" text={t.unavailable} />}
                    </>
                  }
                  line={<bdi>{itemsText(combo, t)}</bdi>}
                  details={
                    <>
                      <span className="tabular-nums">
                        {t.apart} <s>{formatMoney(combo.price.full, currency)}</s>
                      </span>
                      <span className="font-medium text-ink tabular-nums">
                        {t.combo} {formatMoney(combo.price.total, currency)}
                      </span>
                      {saving > 0 && <span className="font-medium text-success tabular-nums">{fmt(t.saves, { amount: formatMoney(saving, currency) })}</span>}
                      {!combo.available && <span className="text-danger">{t.unavailableHint}</span>}
                    </>
                  }
                  onOpen={canManage ? () => setEditing(combo) : undefined}
                  menu={menuFor(combo)}
                />
              );
            })}
          </OfferList>
        )}
      </OfferListState>

      {editing && (
        <ComboEditorDialog
          combo={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
      <ConfirmDialog
        open={archiving !== null}
        title={fmt(t.archiveTitle, { name: archiving?.name ?? "" })}
        description={t.archiveHint}
        confirmLabel={t.archive}
        destructive
        onCancel={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          await combosArchive(apiClient, workspaceId, archiving.id);
          toast.success(fmt(t.archived, { name: archiving.name }));
          setArchiving(null);
          void reload();
        }}
      />
    </OfferPage>
  );
}
