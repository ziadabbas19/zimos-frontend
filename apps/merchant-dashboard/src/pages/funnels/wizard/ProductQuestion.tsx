import { useMemo, useState } from "react";
import { Button } from "@store-builder/ui";
import type { Offer, Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { formatMoney } from "@/lib/format";
import { fmt } from "@/i18n/LocaleContext";
import { IconArrowRight, IconFunnels, IconKey, IconProductAdd, IconWarning } from "@/components/icons";
import { ListSkeleton, ListToolbar } from "@/components/list";
import { ProductImage } from "@/components/ProductImage";
import { StateMessage } from "@/components/DataState";
import { ViewLink } from "@/components/ViewLink";
import { ChoiceCard } from "./ChoiceCard";
import type { WizardStrings } from "./wizardStrings";

/** How many products the list draws at once; typing a name narrows it to the rest. */
const SHOWN = 40;
const PAGES = 3;

/**
 * The store's active products for the first question: the call the wizard
 * always made (active, a hundred at a time), followed for a few pages so the
 * search below — which filters in the browser, as the offers screens do —
 * reaches a bigger catalogue.
 */
export async function loadWizardProducts(workspaceId: string): Promise<Product[]> {
  const products: Product[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < PAGES; page++) {
    const res = await apiClient.listProducts(workspaceId, { status: "active", limit: 100, cursor });
    products.push(...res.products);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return products;
}

/** The product's active offers, main one first (what the order form sells with). */
export function activeOffersOf(product: Product | null): Offer[] {
  const offers = (product?.offers ?? []).filter((o) => o.status === "active");
  return [...offers].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

/** The price a shopper sees first: the main offer's when it has one, else the first variant's. */
export function productPriceText(product: Product): string | null {
  const main = activeOffersOf(product)[0];
  if (main && main.priceAmount !== null) return formatMoney(main.priceAmount, main.currency);
  const variant = (product.variants ?? []).find((v) => v.status === "active") ?? product.variants?.[0];
  return variant ? formatMoney(variant.priceAmount, variant.currency) : null;
}

const QUIET_LINK =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-soft underline-offset-4 " +
  "transition-[color,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/6 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none";

/**
 * "What do you sell?" — the product the funnel sells. The chosen one sits on top with
 * its photo and price; under it the catalogue, searched by name. A store with
 * no products is sent to add one, and may go on without one (the pages then
 * show the store's newest product, as they always did). Two quiet ways out sit
 * at the foot: a funnel code from another merchant, and a funnel that only
 * collects numbers.
 */
export function ProductQuestion({
  t,
  products,
  loading,
  error,
  onRetry,
  value,
  onChange,
  skipped,
  onSkip,
  onCode,
  onLeads,
}: {
  t: WizardStrings;
  /** The store's active products; null until loaded. */
  products: Product[] | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  value: Product | null;
  onChange: (product: Product) => void;
  /** "Continue without a product" is the answer. */
  skipped: boolean;
  onSkip: () => void;
  onCode: () => void;
  onLeads: () => void;
}) {
  const [query, setQuery] = useState("");
  const all = products ?? [];
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return all;
    return all.filter((p) => p.name.toLocaleLowerCase().includes(q) || (p.productCode ?? "").includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, query]);
  const shown = matches.slice(0, SHOWN);

  const ways = (
    <div className="flex flex-col items-start gap-0.5 border-t border-line pt-3">
      <button type="button" className={QUIET_LINK} onClick={onCode}>
        <IconKey className="size-4 shrink-0" aria-hidden />
        {t.haveCode}
      </button>
      <button type="button" className={QUIET_LINK} onClick={onLeads}>
        <IconFunnels className="size-4 shrink-0" aria-hidden />
        {t.onlyLeads}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <ListSkeleton variant="card" rows={4} />
      </div>
    );
  }

  if (error && !products) {
    return (
      <div className="space-y-4">
        <StateMessage
          role="alert"
          tone="danger"
          icon={<IconWarning aria-hidden />}
          title={t.productsFailed}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="min-h-11 rounded-full px-5" onClick={onRetry}>
                {t.retry}
              </Button>
              <Button variant="ghost" className="min-h-11 rounded-full px-5" onClick={onSkip}>
                {t.withoutProduct}
              </Button>
            </div>
          }
        />
        {ways}
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div className="space-y-4">
        <StateMessage
          icon={<IconProductAdd aria-hidden />}
          title={t.noProductsTitle}
          description={t.noProductsBody}
          action={
            <div className="flex flex-col items-center gap-1">
              <Button asChild className="min-h-11 rounded-full px-5">
                <ViewLink to="/catalog/new">
                  {t.addProduct}
                  <IconArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </ViewLink>
              </Button>
              <button type="button" className={QUIET_LINK} onClick={onSkip} aria-pressed={skipped}>
                {t.withoutProduct}
              </button>
              <p className="max-w-xs text-xs leading-5 text-ink-soft">{t.withoutProductHint}</p>
            </div>
          }
        />
        {ways}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {value && (
        <div data-slot="wizard-picked" className="zimos-wizard-picked flex items-center gap-3 rounded-[1.25rem] bg-primary-soft p-3 ring-2 ring-primary">
          <ProductImage media={value.media[0]} alt={value.name} className="size-16 rounded-[0.875rem]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-5 font-medium text-primary-dark dark:text-primary">{t.picked}</p>
            <p className="truncate text-[15px] leading-6 font-semibold text-ink" dir="auto">
              {value.name}
            </p>
            <p className="text-sm leading-5 text-ink-soft tabular-nums">{productPriceText(value) ?? t.noPrice}</p>
          </div>
        </div>
      )}

      <ListToolbar search={{ value: query, onChange: setQuery, placeholder: t.searchProductsPlaceholder, label: t.searchProducts }} />

      <div role="radiogroup" aria-label={t.products} className="flex flex-col gap-2">
        {shown.map((p) => (
          <ChoiceCard
            key={p.id}
            name="funnel-product"
            checked={value?.id === p.id}
            onSelect={() => onChange(p)}
            leading={<ProductImage media={p.media[0]} alt="" className="size-11 rounded-[0.75rem]" />}
            title={p.name}
            hint={<span className="tabular-nums">{productPriceText(p) ?? t.noPrice}</span>}
          />
        ))}
        {matches.length === 0 && <p className="px-1 py-3 text-sm text-ink-soft">{t.noMatch}</p>}
        {matches.length > SHOWN && <p className="px-1 text-xs leading-5 text-ink-soft">{fmt(t.moreProducts, { n: SHOWN })}</p>}
        {!query.trim() && (
          <ChoiceCard name="funnel-product" checked={skipped && !value} onSelect={onSkip} title={t.withoutProduct} hint={t.withoutProductHint} />
        )}
      </div>

      {ways}
    </div>
  );
}
