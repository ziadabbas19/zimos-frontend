import { useId, useMemo, useState } from "react";
import { cn } from "@store-builder/ui";
import type { Product, WorkspaceOfferOption } from "@store-builder/api-client";
import { formatMoney } from "@/lib/format";
import { imageSrc } from "@/lib/media";
import { fmt } from "@/i18n/LocaleContext";
import { IconArrowRight, IconGift, IconOrders, IconTag } from "@/components/icons";
import { ListSkeleton, ListToolbar } from "@/components/list";
import { ViewLink } from "@/components/ViewLink";
import { SwitchTrack } from "@/pages/catalog/variants/SwitchTrack";
import { ChoiceCard } from "./ChoiceCard";
import { activeOffersOf, productPriceText } from "./ProductQuestion";
import type { WizardStrings } from "./wizardStrings";

/** From this many offers up, the list gets a search field. */
const SEARCH_FROM = 8;

function OfferThumb({ offer }: { offer: WorkspaceOfferOption }) {
  const src = offer.imageUrl ? (imageSrc(offer.imageUrl) ?? offer.imageUrl) : null;
  return src ? (
    <img src={src} alt="" loading="lazy" className="size-11 rounded-[0.75rem] bg-paper-sunken object-cover ring-1 ring-line" />
  ) : (
    <span aria-hidden className="flex size-11 items-center justify-center rounded-[0.75rem] bg-paper-sunken text-ink-soft ring-1 ring-line">
      <IconTag className="size-5" />
    </span>
  );
}

/**
 * "Which offer?" — two things, both about offers.
 *
 * The order form: a funnel's form sells the product with its main offer (the
 * storefront's rule), so this says which one that is and lists the product's
 * other offers; they are changed on the product's page, not here.
 *
 * The offer after the order: one switch. On, the funnel gets an offer step
 * (upsell) and the merchant picks what it offers — one of this product's
 * offers first, then the rest of the store's — or leaves it for the editor.
 */
export function OfferQuestion({
  t,
  product,
  upsell,
  onUpsellChange,
  offerId,
  onOfferChange,
  offers,
  offersLoading,
  offersError,
}: {
  t: WizardStrings;
  /** The product from the first question; null when the merchant went on without one. */
  product: Product | null;
  upsell: boolean;
  onUpsellChange: (on: boolean) => void;
  /** The offer for the offer step; null = chosen later in the editor. */
  offerId: string | null;
  onOfferChange: (offerId: string | null) => void;
  /** The store's active offers; null until loaded. */
  offers: WorkspaceOfferOption[] | null;
  offersLoading: boolean;
  offersError: unknown;
}) {
  const switchLabel = useId();
  const switchHint = useId();
  const [query, setQuery] = useState("");
  const own = activeOffersOf(product);
  const main = own[0] ?? null;
  const price = product ? productPriceText(product) : null;

  const formLine = !product
    ? t.orderFormNoProduct
    : main
      ? fmt(t.orderFormOffer, { offer: main.priceAmount !== null ? `${main.name} · ${formatMoney(main.priceAmount, main.currency)}` : main.name })
      : price
        ? fmt(t.orderFormPrice, { price })
        : t.orderFormPlain;

  const all = offers ?? [];
  const { mine, others } = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const hit = (o: WorkspaceOfferOption) => !q || o.name.toLocaleLowerCase().includes(q) || o.productName.toLocaleLowerCase().includes(q);
    const kept = all.filter(hit);
    return { mine: kept.filter((o) => o.productId === product?.id), others: kept.filter((o) => o.productId !== product?.id) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, query, product?.id]);

  const card = (o: WorkspaceOfferOption) => (
    <ChoiceCard
      key={o.id}
      name="funnel-upsell-offer"
      checked={offerId === o.id}
      onSelect={() => onOfferChange(o.id)}
      leading={<OfferThumb offer={o} />}
      title={o.name}
      hint={
        <span className="flex min-w-0 items-center gap-2">
          {o.priceAmount !== null && <span className="shrink-0 font-medium text-ink tabular-nums">{formatMoney(o.priceAmount, o.currency)}</span>}
          <bdi className="min-w-0 truncate">{o.productName}</bdi>
        </span>
      }
    />
  );

  return (
    <div className="space-y-4">
      <section data-slot="wizard-note" className="zimos-wizard-note rounded-[1.25rem] bg-paper-raised p-3.5 ring-1 ring-line">
        <h3 className="flex items-center gap-2 text-sm leading-5 font-semibold text-ink">
          <IconOrders className="size-[18px] shrink-0 text-ink-soft" aria-hidden />
          {t.orderForm}
        </h3>
        <p className="mt-1 text-sm leading-6 text-ink-soft">{formLine}</p>
        {own.length > 1 && (
          <ul aria-label={t.productOffers} className="mt-2 flex flex-col gap-1">
            {own.map((o) => (
              <li key={o.id} className="flex min-h-9 items-center gap-2 rounded-[0.75rem] bg-paper-sunken/70 px-3 text-sm text-ink">
                <bdi className="min-w-0 flex-1 truncate">{o.name}</bdi>
                {o.isDefault && <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] leading-4 font-medium text-primary-dark dark:text-primary">{t.mainOffer}</span>}
                {o.priceAmount !== null && <span className="shrink-0 text-ink-soft tabular-nums">{formatMoney(o.priceAmount, o.currency)}</span>}
              </li>
            ))}
          </ul>
        )}
        {product && (
          <ViewLink
            to={`/catalog/${product.id}`}
            target="_blank"
            rel="noreferrer"
            className="-ms-2 mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t.manageOffers}
            <IconArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </ViewLink>
        )}
      </section>

      <button
        type="button"
        role="switch"
        aria-checked={upsell}
        aria-labelledby={switchLabel}
        aria-describedby={switchHint}
        onClick={() => onUpsellChange(!upsell)}
        data-slot="wizard-switch"
        data-active={upsell ? "" : undefined}
        className={cn(
          "zimos-wizard-choice flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[1.25rem] p-3.5 text-start",
          "transition-[scale,background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.985] motion-reduce:transition-none",
          upsell ? "bg-primary-soft ring-2 ring-primary" : "bg-paper-raised ring-1 ring-line hover:bg-paper-sunken"
        )}
      >
        <IconGift className="size-6 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span id={switchLabel} className="block text-[15px] leading-6 font-semibold text-ink">
            {t.upsell}
          </span>
          <span id={switchHint} className="block text-[13px] leading-5 text-ink-soft">
            {t.upsellHint}
          </span>
        </span>
        <SwitchTrack on={upsell} />
      </button>

      {upsell && (
        <section className="space-y-2">
          <h3 className="px-1 text-sm leading-5 font-semibold text-ink">{t.upsellWhich}</h3>
          {all.length >= SEARCH_FROM && (
            <ListToolbar search={{ value: query, onChange: setQuery, placeholder: t.searchProductsPlaceholder, label: t.upsellWhich }} />
          )}
          <div role="radiogroup" aria-label={t.upsellWhich} className="flex flex-col gap-2">
            <ChoiceCard name="funnel-upsell-offer" checked={offerId === null} onSelect={() => onOfferChange(null)} title={t.upsellLater} hint={t.upsellLaterHint} />
            {offersLoading ? (
              <ListSkeleton variant="card" rows={2} />
            ) : offersError && !offers ? (
              <p role="status" className="px-1 text-sm leading-6 text-ink-soft">
                {t.offersFailed}
              </p>
            ) : all.length === 0 ? (
              <p className="px-1 text-sm leading-6 text-ink-soft">{t.noOffers}</p>
            ) : (
              <>
                {mine.length > 0 && others.length > 0 && <p className="px-1 pt-1 text-xs leading-5 font-medium text-ink-soft">{t.fromThisProduct}</p>}
                {mine.map(card)}
                {mine.length > 0 && others.length > 0 && <p className="px-1 pt-1 text-xs leading-5 font-medium text-ink-soft">{t.otherOffers}</p>}
                {others.map(card)}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
