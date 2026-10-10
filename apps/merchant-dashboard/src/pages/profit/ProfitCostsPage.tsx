import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@store-builder/ui";
import {
  profitGetEconomics,
  profitResetProductEconomics,
  profitSaveDefaults,
  profitSaveProductEconomics,
  type ProfitEconomics,
  type ProfitEconomicsProduct,
} from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { CardSkeleton, DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconEdit, IconProduct, IconProducts, IconRotateBack, IconSearch } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import type { QuickLookRowProps } from "@/components/QuickLook";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { pluralOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { UnsavedGuardProvider, useReportDirty, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { LeaveGuard } from "@/pages/catalog/product/LeaveGuard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { AmountInput, focusField } from "./CostFields";
import {
  COST_META,
  COSTS_STRINGS,
  MONEY_META,
  PERCENT_META,
  readForm,
  sameForm,
  toForm,
  type CostErrors,
  type CostFieldMeta,
  type CostForm,
} from "./costsModel";
import { ProductCostsSheet, costRange } from "./ProductCostsSheet";

/** The products sheet from a wide screen up: the product, what a piece costs, its price, whose costs it uses, the way in. */
const PRODUCT_COLUMNS = "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_max-content_max-content]";

type CostChip = "all" | "noCost" | "custom";

const lacksCost = (product: ProfitEconomicsProduct) => product.minCostAmount === null || product.variantsWithoutCost > 0;

/** Space or Enter on a focused row opens its sheet, the way a press does. */
function openKeys(open: () => void): QuickLookRowProps {
  return {
    tabIndex: 0,
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (event.target !== event.currentTarget || event.repeat || event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    },
  };
}

/**
 * Costs (/profit/costs) — what every order really costs: the store defaults
 * as two groups of settings with the amount typed in the row, and the
 * products, each of which may have costs of its own (a sheet over the list).
 *
 * The defaults are one form: the save bar shows once something changed, each
 * field says what is wrong with it under itself, and leaving the page with
 * unsaved defaults asks first.
 */
export function ProfitCostsPage() {
  return (
    <UnsavedGuardProvider>
      <LeaveGuard className="min-w-0 max-w-5xl">
        <CostsPage />
      </LeaveGuard>
    </UnsavedGuardProvider>
  );
}

function CostsPage() {
  const t = useT(COSTS_STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const phone = useIsPhone();
  const list = useCachedAsync(
    workspaceId ? `profit-costs:${workspaceId}` : null,
    () => profitGetEconomics(apiClient, workspaceId),
    [workspaceId]
  );
  const data = list.data;
  // The product in the sheet. It stays here while the sheet closes, so the sheet does not empty on its way out.
  const [editing, setEditing] = useState<{ id: string; open: boolean } | null>(null);
  const savedDefaults = useMemo(() => toForm(data?.defaults ?? null), [data]);
  const edited = editing && data ? (data.products.find((product) => product.productId === editing.id) ?? null) : null;

  const closeSheet = () => setEditing((current) => (current ? { ...current, open: false } : current));

  async function saveDefaults(payload: ProfitEconomics) {
    await profitSaveDefaults(apiClient, workspaceId, payload);
    toast.success(t.saved);
    await list.refresh({ silent: true });
  }

  async function saveProduct(product: ProfitEconomicsProduct, payload: ProfitEconomics) {
    await profitSaveProductEconomics(apiClient, workspaceId, product.productId, payload);
    closeSheet();
    toast.success(t.saved);
    await list.refresh({ silent: true });
  }

  /** Back to the store defaults — and the way back from that, while the toast is up. */
  async function resetProduct(product: ProfitEconomicsProduct) {
    const before = product.overrides;
    await profitResetProductEconomics(apiClient, workspaceId, product.productId);
    closeSheet();
    const message = fmt(t.resetDone, { name: product.name });
    if (before) {
      toast.undo(message, async () => {
        await profitSaveProductEconomics(apiClient, workspaceId, product.productId, before);
        await list.refresh({ silent: true });
      });
    } else {
      toast.success(message);
    }
    await list.refresh({ silent: true });
  }

  return (
    <>
      <PageHeader title={t.title} description={phone ? undefined : t.description} back={{ to: "/profit", label: t.back }} />

      <DataState
        loading={list.loading && !data}
        // A refresh that failed behind a form already on screen leaves it there.
        error={data ? null : list.error}
        onRetry={() => void list.refresh()}
        skeleton={
          <div className="flex flex-col gap-[var(--bento-gap)]">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
            <ListSkeleton rows={4} />
          </div>
        }
      >
        {data && (
          <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
            <DefaultsForm saved={savedDefaults} currency={currency} onSave={saveDefaults} />
            <ProductsList
              products={data.products}
              currency={currency}
              onEdit={(product) => setEditing({ id: product.productId, open: true })}
              onReset={(product) => void resetProduct(product).catch((err: unknown) => toast.error(getErrorMessage(err)))}
            />
          </div>
        )}
      </DataState>

      <ProductCostsSheet
        product={edited}
        open={Boolean(editing?.open && edited)}
        currency={currency}
        defaults={savedDefaults}
        onClose={closeSheet}
        onSave={saveProduct}
        onReset={resetProduct}
      />
    </>
  );
}

/** The store defaults: two groups of rows, the amount typed in the row, one save for the six. */
function DefaultsForm({
  saved,
  currency,
  onSave,
}: {
  /** What is saved now, as the fields show it. */
  saved: CostForm;
  currency: string;
  onSave: (payload: ProfitEconomics) => Promise<void>;
}) {
  const t = useT(COSTS_STRINGS);
  const toast = useToast();
  const baseId = useId();
  const idOf = (field: string) => `${baseId}-${field}`;
  const [form, setForm] = useState<CostForm>(saved);
  const [errors, setErrors] = useState<CostErrors>({});
  const [saving, setSaving] = useState(false);

  // The fields follow what is saved only when THAT changes (a save of this form), never when the
  // list is refreshed for another reason — a product's costs — while the merchant is typing here.
  const savedKey = COST_META.map((meta) => saved[meta.field]).join("|");
  const [seenKey, setSeenKey] = useState(savedKey);
  if (seenKey !== savedKey) {
    setSeenKey(savedKey);
    setForm(saved);
    setErrors({});
  }

  const dirty = !sameForm(form, saved);
  useReportDirty(dirty);
  const anyWrong = COST_META.some((meta) => errors[meta.field]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const { payload, errors: found } = readForm(form);
    setErrors(found);
    if (!payload) {
      const first = COST_META.find((meta) => found[meta.field]);
      if (first) focusField(idOf(first.field));
      return;
    }
    setSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const row = (meta: CostFieldMeta) => {
    const wrong = errors[meta.field];
    return (
      <SettingsRow
        key={meta.field}
        label={t[meta.label]}
        hint={t[meta.hint]}
        htmlFor={idOf(meta.field)}
        error={wrong ? (wrong === "money" ? t.invalidMoney : t.invalidPercent) : undefined}
        control={
          <AmountInput
            id={idOf(meta.field)}
            value={form[meta.field]}
            onChange={(value) => {
              setForm((prev) => ({ ...prev, [meta.field]: value }));
              if (wrong) setErrors((prev) => ({ ...prev, [meta.field]: undefined }));
            }}
            adornment={meta.kind === "money" ? currency : "%"}
            invalid={Boolean(wrong)}
            className="w-full sm:w-44"
          />
        }
      />
    );
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
      <SettingsGroup title={t.perOrderTitle} description={t.defaultsNote}>
        {MONEY_META.map(row)}
      </SettingsGroup>
      <SettingsGroup title={t.ratesTitle}>{PERCENT_META.map(row)}</SettingsGroup>
      <SaveBar
        dirty={dirty}
        saving={saving}
        message={anyWrong ? t.fixFields : undefined}
        onDiscard={() => {
          setForm(saved);
          setErrors({});
        }}
      />
    </form>
  );
}

/** The products and whose costs each one uses: a card per product on the phone, a sheet of rows from a wide screen. */
function ProductsList({
  products,
  currency,
  onEdit,
  onReset,
}: {
  products: ProfitEconomicsProduct[];
  currency: string;
  onEdit: (product: ProfitEconomicsProduct) => void;
  onReset: (product: ProfitEconomicsProduct) => void;
}) {
  const t = useT(COSTS_STRINGS);
  const compact = useIsCompact();
  const headingId = useId();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<CostChip>("all");

  const query = search.trim().toLowerCase();
  const visible = products.filter((product) => {
    if (chip === "noCost" && !lacksCost(product)) return false;
    if (chip === "custom" && !product.overrides) return false;
    return query === "" || product.name.toLowerCase().includes(query);
  });

  const chips: ChipItem<CostChip>[] = [
    { value: "all", label: t.chipAll, count: products.length },
    { value: "noCost", label: t.chipNoCost, count: products.filter(lacksCost).length, tone: "attention" },
    { value: "custom", label: t.chipCustom, count: products.filter((product) => product.overrides).length },
  ];

  const rows = visible.map((product) => (
    <CostProductRow
      key={product.productId}
      product={product}
      currency={currency}
      compact={compact}
      onEdit={() => onEdit(product)}
      onReset={() => onReset(product)}
    />
  ));

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3 pt-2">
      <div className="px-1">
        <h2 id={headingId} className="text-[15px] leading-6 font-semibold text-ink">
          {t.productsTitle}
        </h2>
        <p className="mt-0.5 text-[13px] leading-5 text-pretty text-ink-soft">{t.productsDesc}</p>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<IconProducts aria-hidden />}
          title={t.noProducts}
          description={t.noProductsHint}
          action={
            <Button asChild className="min-h-11 rounded-full px-5">
              <ViewLink to="/catalog/new">{t.addProduct}</ViewLink>
            </Button>
          }
        />
      ) : (
        <>
          <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
          <ChipRow items={chips} value={chip} onChange={setChip} label={t.chipsLabel} collapseEmpty={false} />
          {visible.length === 0 ? (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.noMatch}
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full px-5"
                  onClick={() => {
                    setSearch("");
                    setChip("all");
                  }}
                >
                  {t.clearAll}
                </Button>
              }
            />
          ) : compact ? (
            <ul aria-label={t.productsTitle} className="flex flex-col gap-2.5">
              {rows}
            </ul>
          ) : (
            <DeskList
              columns={PRODUCT_COLUMNS}
              label={t.productsTitle}
              head={[
                { label: t.colProduct },
                { label: t.colUnitCost },
                { label: t.colPrice },
                { label: t.colCosts },
                { label: t.colAction, end: true },
              ]}
            >
              {rows}
            </DeskList>
          )}
        </>
      )}
    </section>
  );
}

/**
 * One product: its name, what a piece costs (or the way to say so), its price
 * and whether it uses the store's costs or its own. A press anywhere opens
 * the sheet of its costs; the menu of the row (right-click, a long press,
 * Shift+F10) also leads to the product and drops its own costs.
 */
function CostProductRow({
  product,
  currency,
  compact,
  onEdit,
  onReset,
}: {
  product: ProfitEconomicsProduct;
  currency: string;
  compact: boolean;
  onEdit: () => void;
  onReset: () => void;
}) {
  const t = useT(COSTS_STRINGS);
  const navigate = useViewNavigate();
  const { confirmLeave } = useUnsavedGuard();
  const productPage = `/catalog/${product.productId}`;
  const noCost = product.minCostAmount === null;
  const openLabel = fmt(t.editTitle, { name: product.name });

  const menu: ContextMenuItem[] = [
    { id: "edit", label: t.editCosts, icon: IconEdit, onSelect: onEdit },
    {
      id: "product",
      label: noCost ? t.setUnitCost : t.openProduct,
      icon: IconProduct,
      // Leaving with unsaved store defaults asks first, like the links of the page do.
      onSelect: () => void confirmLeave().then((leave) => (leave ? navigate(productPage) : undefined)),
    },
  ];
  if (product.overrides) {
    menu.push({ id: "reset", label: t.reset, icon: IconRotateBack, separatorBefore: true, onSelect: onReset });
  }

  const badge = (
    <StatusBadge
      value={product.overrides ? "custom" : "default"}
      tone={product.overrides ? "info" : "neutral"}
      text={product.overrides ? t.custom : t.usesDefaults}
    />
  );
  const someMissing = !noCost && product.variantsWithoutCost > 0 ? pluralOf(t, "someMissing", product.variantsWithoutCost) : null;
  const unitCostLink = (
    <ViewLink
      to={productPage}
      className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-0"
    >
      {t.setUnitCost}
    </ViewLink>
  );

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            title={<bdi>{product.name}</bdi>}
            amount={
              noCost ? (
                <span className="text-[13px] font-medium text-danger">{t.missingCost}</span>
              ) : (
                <bdi dir="ltr">{costRange(product.minCostAmount, product.maxCostAmount, currency)}</bdi>
              )
            }
            status={badge}
            meta={
              <>
                {t.colPrice} <bdi dir="ltr">{costRange(product.minPriceAmount, product.maxPriceAmount, currency)}</bdi>
              </>
            }
            action={<RowAction tone="quiet" label={t.edit} onClick={onEdit} />}
            footer={
              noCost ? (
                unitCostLink
              ) : someMissing ? (
                <span className="text-xs font-medium text-danger">{someMissing}</span>
              ) : undefined
            }
            onOpen={onEdit}
            openLabel={openLabel}
            aria-haspopup="dialog"
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onEdit} openLabel={openLabel} keyProps={openKeys(onEdit)} menu={menu} menuLabel={t.menuLabel}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          <bdi>{product.name}</bdi>
        </p>
        {someMissing && <p className="truncate text-xs leading-5 font-medium text-danger">{someMissing}</p>}
      </div>
      <div className="min-w-0 text-sm text-ink tabular-nums">
        {noCost ? unitCostLink : <bdi dir="ltr">{costRange(product.minCostAmount, product.maxCostAmount, currency)}</bdi>}
      </div>
      <div className="min-w-0 text-sm text-ink-soft tabular-nums">
        <bdi dir="ltr">{costRange(product.minPriceAmount, product.maxPriceAmount, currency)}</bdi>
      </div>
      <div className="flex items-center">{badge}</div>
      <div className="flex items-center justify-end">
        <RowAction tone="quiet" label={t.edit} icon={IconEdit} onClick={onEdit} />
      </div>
    </DeskRow>
  );
}
