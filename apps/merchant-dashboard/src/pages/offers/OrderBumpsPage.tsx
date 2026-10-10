import { useState } from "react";
import { IconCheck, IconDelete, IconEdit, IconPlus, IconPower, IconProductAdd, IconSparkle } from "@/components/icons";
import { Button } from "@store-builder/ui";
import {
  offersDeleteBump,
  offersListBumps,
  offersListUpsells,
  offersDeleteUpsell,
  offersSaveBump,
  offersSaveUpsell,
  type OrderBumpRule,
  type UpsellRule,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { OfferPicker } from "@/components/OfferPicker";
import { TextField } from "@/components/Field";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ProductSelect, useStoreProducts } from "./OfferRuleParts";
import { OfferNumbers, useOfferStats } from "./OfferNumbers";
import { FormProblem, OfferList, OfferListState, OfferPage, OfferPreview, OfferRow, SheetActions, TOUCH_BUTTON } from "./OfferKit";

/**
 * Two screens with one shape (SPEC §10.3, §10.4): an order bump is an offer
 * ticked on a product's order form; a post-purchase upsell is an offer added
 * with one tap on the thank-you page. Each rule is "on this product (or
 * all) → sell this offer", with a headline and a description. The list shows
 * what each one sells and where, its numbers and its state switch; a row
 * opens the rule's sheet.
 */

const STRINGS = {
  en: {
    bumpsTitle: "Order bumps",
    bumpsDescription: "A tick box above the order button: “add this to your order”. Up to three on a product.",
    upsellsTitle: "Post-purchase upsell",
    upsellsDescription: "One offer on the thank-you page, added to the same cash-on-delivery order with one tap — before anyone confirms it.",
    newBump: "New order bump",
    newUpsell: "New upsell",
    bumpsList: "Your order bumps",
    upsellsList: "Your upsells",
    emptyBumps: "No order bumps yet",
    emptyBumpsHint: "Offer a small add-on right where the customer orders — a charger, a second colour, a gift box.",
    emptyUpsells: "No upsells yet",
    emptyUpsellsHint: "Right after the order, offer one more thing that goes with it.",
    onProduct: "On {name}",
    onAll: "On every product",
    afterProduct: "After an order of {name}",
    afterAll: "After any order",
    sells: "{offer} for {price}",
    offerOf: "{product} · {offer}",
    offerGone: "Offer unavailable",
    preChecked: "Ticked by default",
    createBump: "New order bump",
    editBump: "Edit order bump",
    createUpsell: "New upsell",
    editUpsell: "Edit upsell",
    bumpProduct: "Show on",
    bumpProductHint: "Leave on “Every product” to offer it everywhere.",
    upsellProduct: "Show after an order of",
    upsellAny: "Any product",
    offer: "The offer to sell",
    offerHint: "An offer with a set price, created on a product's page. Its price is what the customer pays.",
    headline: "Headline",
    bumpHeadlinePlaceholder: "Add a charger for only 99",
    upsellHeadlinePlaceholder: "Add this before we ship your order",
    details: "Description",
    preCheckedLabel: "Ticked by default",
    preCheckedHint: "The customer can still untick it. Use with care: an add-on nobody asked for raises refusals at the door.",
    offerRequired: "Choose the offer to sell: the shopper needs something to add.",
    previewBump: "On the order form, the shopper sees",
    previewUpsell: "On the thank-you page, the shopper sees",
    previewOffer: "the offer's name",
    previewAdd: "Add to my order",
    edit: "Edit",
    turnOn: "Turn on",
    turnOff: "Turn off",
    turnedOn: "“{name}” is on.",
    turnedOff: "“{name}” is off.",
    saved: "Saved.",
    delete: "Delete",
    deleted: "Deleted.",
    deleteTitle: "Delete “{name}”?",
    deleteBumpHint: "The order form stops offering it. Orders that already took it keep it.",
    deleteUpsellHint: "The thank-you page stops offering it. Orders that already took it keep it.",
  },
  ar: {
    bumpsTitle: "إضافات الطلب",
    bumpsDescription: "مربع اختيار فوق زر الطلب: «أضف هذا إلى طلبك». حتى ثلاثة على المنتج.",
    upsellsTitle: "عرض بعد الشراء",
    upsellsDescription: "عرض واحد في صفحة الشكر، يُضاف إلى طلب الدفع عند الاستلام نفسه بضغطة واحدة — قبل أن يؤكده أحد.",
    newBump: "إضافة طلب جديدة",
    newUpsell: "عرض جديد",
    bumpsList: "إضافات الطلب لديك",
    upsellsList: "عروض ما بعد الشراء لديك",
    emptyBumps: "لا توجد إضافات طلب بعد",
    emptyBumpsHint: "اعرض إضافة صغيرة في مكان الطلب نفسه — شاحن، لون ثانٍ، علبة هدية.",
    emptyUpsells: "لا توجد عروض بعد الشراء",
    emptyUpsellsHint: "بعد الطلب مباشرة، اعرض شيئًا آخر يناسبه.",
    onProduct: "على {name}",
    onAll: "على كل المنتجات",
    afterProduct: "بعد طلب فيه {name}",
    afterAll: "بعد أي طلب",
    sells: "{offer} بسعر {price}",
    offerOf: "{product} · {offer}",
    offerGone: "العرض غير متاح",
    preChecked: "محدد افتراضيًا",
    createBump: "إضافة طلب جديدة",
    editBump: "تعديل إضافة الطلب",
    createUpsell: "عرض جديد",
    editUpsell: "تعديل العرض",
    bumpProduct: "يظهر على",
    bumpProductHint: "اتركه على «كل المنتجات» ليظهر في كل مكان.",
    upsellProduct: "يظهر بعد طلب فيه",
    upsellAny: "أي منتج",
    offer: "العرض الذي يُباع",
    offerHint: "عرض بسعر محدد، يُنشأ من صفحة المنتج. سعره هو ما يدفعه العميل.",
    headline: "العنوان",
    bumpHeadlinePlaceholder: "أضف شاحنًا بـ 99 فقط",
    upsellHeadlinePlaceholder: "أضف هذا قبل شحن طلبك",
    details: "الوصف",
    preCheckedLabel: "محدد افتراضيًا",
    preCheckedHint: "العميل يقدر يلغي التحديد. استخدمه بحذر: إضافة لم يطلبها أحد تزيد الرفض عند الاستلام.",
    offerRequired: "اختر العرض الذي يُباع: يحتاج العميل إلى شيء يضيفه.",
    previewBump: "ما يراه العميل في نموذج الطلب",
    previewUpsell: "ما يراه العميل في صفحة الشكر",
    previewOffer: "اسم العرض",
    previewAdd: "أضفه إلى طلبي",
    edit: "تعديل",
    turnOn: "تفعيل",
    turnOff: "إيقاف",
    turnedOn: "تم تفعيل «{name}».",
    turnedOff: "تم إيقاف «{name}».",
    saved: "تم الحفظ.",
    delete: "حذف",
    deleted: "تم الحذف.",
    deleteTitle: "حذف «{name}»؟",
    deleteBumpHint: "لن يعرضها نموذج الطلب بعد الآن. الطلبات التي تضمّنتها من قبل تبقى كما هي.",
    deleteUpsellHint: "لن تعرضه صفحة الشكر بعد الآن. الطلبات التي تضمّنته من قبل تبقى كما هي.",
  },
} satisfies Messages;

type Kind = "bump" | "upsell";

/** The two rule types read through one shape. */
interface Row {
  id: string;
  productId: string | null;
  offerId: string;
  headline: string | null;
  description: string | null;
  preChecked: boolean;
  position: number;
  isActive: boolean;
  offer: OrderBumpRule["offer"];
  product: OrderBumpRule["product"];
}

const fromBump = (r: OrderBumpRule): Row => ({ ...r });
const fromUpsell = (r: UpsellRule): Row => ({ ...r, productId: r.triggerProductId, preChecked: false });

function useRules(kind: Kind) {
  const workspaceId = useWorkspaceId();
  // Shown at once from the session's copy on the way back from the hub, and read again behind it.
  const list = useCachedAsync(
    `offer-${kind}s:${workspaceId}`,
    () =>
      kind === "bump"
        ? offersListBumps(apiClient, workspaceId).then((rows) => rows.map(fromBump))
        : offersListUpsells(apiClient, workspaceId).then((rows) => rows.map(fromUpsell)),
    [workspaceId, kind]
  );
  const save = (id: string | null, row: Omit<Row, "id" | "offer" | "product">) => {
    const common = { offerId: row.offerId, headline: row.headline, description: row.description, position: row.position, isActive: row.isActive };
    return kind === "bump"
      ? offersSaveBump(apiClient, workspaceId, id, { ...common, productId: row.productId, preChecked: row.preChecked })
      : offersSaveUpsell(apiClient, workspaceId, id, { ...common, triggerProductId: row.productId });
  };
  const remove = (id: string) =>
    kind === "bump" ? offersDeleteBump(apiClient, workspaceId, id) : offersDeleteUpsell(apiClient, workspaceId, id);
  return { list, save, remove };
}

function OfferRulesPage({ kind }: { kind: Kind }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { list, save, remove } = useRules(kind);
  // Each rule's views, acceptances and added revenue.
  const stats = useOfferStats();
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = list.data ?? [];
  const isBump = kind === "bump";
  const nameOf = (row: Row) => row.headline || row.offer?.name || t.offerGone;

  /** The switch moves at once; a refusal puts it back and says why. Undo is the opposite save. */
  async function setActive(row: Row, isActive: boolean, undoable = true): Promise<void> {
    setBusyId(row.id);
    list.setData((prev) => (prev ?? []).map((r) => (r.id === row.id ? { ...r, isActive } : r)));
    try {
      await save(row.id, { ...row, isActive });
      const said = fmt(isActive ? t.turnedOn : t.turnedOff, { name: nameOf(row) });
      if (undoable) toast.undo(said, () => setActive(row, !isActive, false));
      else toast.success(said);
      void list.refresh({ silent: true });
    } catch (err) {
      list.setData((prev) => (prev ?? []).map((r) => (r.id === row.id ? { ...r, isActive: !isActive } : r)));
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const newButton = (
    <Button type="button" className={TOUCH_BUTTON} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" aria-hidden />
      {isBump ? t.newBump : t.newUpsell}
    </Button>
  );

  const menuFor = (row: Row): ContextMenuItem[] => [
    { id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing(row) },
    { id: "toggle", label: row.isActive ? t.turnOff : t.turnOn, icon: IconPower, onSelect: () => void setActive(row, !row.isActive) },
    { id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(row) },
  ];

  return (
    <OfferPage
      title={isBump ? t.bumpsTitle : t.upsellsTitle}
      description={isBump ? t.bumpsDescription : t.upsellsDescription}
      primaryAction={rows.length > 0 ? newButton : undefined}
    >
      <OfferListState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {rows.length === 0 ? (
          <EmptyState
            icon={isBump ? <IconProductAdd /> : <IconSparkle />}
            title={isBump ? t.emptyBumps : t.emptyUpsells}
            description={isBump ? t.emptyBumpsHint : t.emptyUpsellsHint}
            action={newButton}
          />
        ) : (
          <OfferList label={isBump ? t.bumpsList : t.upsellsList}>
            {rows.map((row) => (
              <OfferRow
                key={row.id}
                name={nameOf(row)}
                badge={row.offer?.usable ? undefined : <StatusBadge value="warning" tone="warning" text={t.offerGone} />}
                line={
                  row.offer ? (
                    <bdi>
                      {fmt(t.sells, {
                        offer: row.offer.productName ? fmt(t.offerOf, { product: row.offer.productName, offer: row.offer.name }) : row.offer.name,
                        price: formatMoney(row.offer.priceAmount, row.offer.currency),
                      })}
                    </bdi>
                  ) : undefined
                }
                details={
                  <>
                    <span>
                      <bdi>
                        {row.product
                          ? fmt(isBump ? t.onProduct : t.afterProduct, { name: row.product.name })
                          : isBump
                            ? t.onAll
                            : t.afterAll}
                      </bdi>
                    </span>
                    {row.preChecked && <span>{t.preChecked}</span>}
                    <OfferNumbers stat={(isBump ? stats?.bumps : stats?.upsells)?.[row.id]} />
                  </>
                }
                onOpen={() => setEditing(row)}
                toggle={{ checked: row.isActive, busy: busyId === row.id, onChange: (next) => void setActive(row, next) }}
                menu={menuFor(row)}
              />
            ))}
          </OfferList>
        )}
      </OfferListState>

      {editing && (
        <RuleDialog
          kind={kind}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          save={save}
          onSaved={() => {
            setEditing(null);
            void list.refresh({ silent: true });
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.deleteTitle, { name: deleting ? nameOf(deleting) : "" })}
        description={isBump ? t.deleteBumpHint : t.deleteUpsellHint}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await remove(deleting.id);
          toast.success(t.deleted);
          setDeleting(null);
          void list.refresh({ silent: true });
        }}
      />
    </OfferPage>
  );
}

function RuleDialog({
  kind,
  row,
  onClose,
  save,
  onSaved,
}: {
  kind: Kind;
  row: Row | null;
  onClose: () => void;
  save: (id: string | null, row: Omit<Row, "id" | "offer" | "product">) => Promise<unknown>;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const products = useStoreProducts();
  const isBump = kind === "bump";
  const [productId, setProductId] = useState<string | null>(row?.productId ?? null);
  const [offerId, setOfferId] = useState<string | null>(row?.offerId ?? null);
  const [headline, setHeadline] = useState(row?.headline ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [preChecked, setPreChecked] = useState(row?.preChecked ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!offerId) {
      setError(t.offerRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save(row?.id ?? null, {
        productId,
        offerId,
        headline: headline.trim() || null,
        description: description.trim() || null,
        preChecked,
        position: row?.position ?? 0,
        isActive: row?.isActive ?? true,
      });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  // The words the shopper reads: the headline, or the saved offer's own name while none is written.
  const shownHeadline = headline.trim() || (row && row.offerId === offerId ? row.offer?.name : undefined) || t.previewOffer;
  const shownPrice = row && row.offerId === offerId && row.offer ? formatMoney(row.offer.priceAmount, row.offer.currency) : null;

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={isBump ? (row ? t.editBump : t.createBump) : row ? t.editUpsell : t.createUpsell}
      footer={<SheetActions busy={busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <div className="space-y-4">
        <ProductSelect
          id="rule-product"
          label={isBump ? t.bumpProduct : t.upsellProduct}
          hint={isBump ? t.bumpProductHint : undefined}
          anyLabel={isBump ? undefined : t.upsellAny}
          products={products.data ?? []}
          value={productId}
          onChange={setProductId}
          disabled={busy || products.loading}
        />
        <OfferPicker
          workspaceId={workspaceId}
          value={offerId}
          onChange={(next) => {
            setOfferId(next);
            setError(null);
          }}
          disabled={busy}
          label={t.offer}
          hint={t.offerHint}
        />
        <TextField
          label={t.headline}
          maxLength={120}
          placeholder={isBump ? t.bumpHeadlinePlaceholder : t.upsellHeadlinePlaceholder}
          value={headline}
          disabled={busy}
          onChange={(e) => setHeadline(e.target.value)}
        />
        <TextField label={t.details} maxLength={300} value={description} disabled={busy} onChange={(e) => setDescription(e.target.value)} />
        {isBump && (
          <SettingsGroup>
            <SettingsSwitch checked={preChecked} onChange={setPreChecked} label={t.preCheckedLabel} hint={t.preCheckedHint} disabled={busy} />
          </SettingsGroup>
        )}

        <OfferPreview label={isBump ? t.previewBump : t.previewUpsell}>
          <div className="flex items-start gap-3">
            {isBump && (
              <span
                aria-hidden
                className={
                  preChecked
                    ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-primary text-primary-foreground"
                    : "mt-0.5 size-5 shrink-0 rounded-[6px] ring-[1.5px] ring-line-strong ring-inset"
                }
              >
                {preChecked ? <IconCheck className="size-3.5" /> : null}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">
                <bdi>{shownHeadline}</bdi>
                {shownPrice && (
                  <span className="ms-2 font-medium text-ink-soft tabular-nums">
                    <bdi>{shownPrice}</bdi>
                  </span>
                )}
              </p>
              {description.trim() && (
                <p className="text-[13px] leading-5 text-ink-soft">
                  <bdi>{description.trim()}</bdi>
                </p>
              )}
              {!isBump && (
                <span className="mt-2 inline-flex min-h-9 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground">{t.previewAdd}</span>
              )}
            </div>
          </div>
        </OfferPreview>

        <FormProblem>{error}</FormProblem>
      </div>
    </Modal>
  );
}

export function OrderBumpsPage() {
  return <OfferRulesPage kind="bump" />;
}

export function UpsellsPage() {
  return <OfferRulesPage kind="upsell" />;
}
