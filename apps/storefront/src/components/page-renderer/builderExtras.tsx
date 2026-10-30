import type { StorefrontProductDetail } from "@store-builder/api-client";
import { ProductReviews } from "@/components/product/ProductReviews";
import { bundleTiers } from "@/lib/commerce";
import { productImages } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreMeta } from "@/lib/storeMeta";
import { storefrontProductReviews } from "@store-builder/api-client";
import { BundleChoice, GalleryWithThumbs, PopupBlock, VariantChips } from "./builderExtrasClient";
import { type Props, bool, num, resolveHref, safeUrl, str } from "./props";

/**
 * The builder elements of backend pages/builderExtras.js (SPEC §9.3, item
 * 44): image_gallery, variant_selector, bundle_selector and review_form. A
 * product element with no product of its own uses the page's product, else
 * the store's newest. Each draws nothing when it has nothing to show.
 */

export const EXTRA_ELEMENT_TYPES = new Set(["image_gallery", "variant_selector", "bundle_selector", "review_form", "popup"]);

async function productFor(workspaceId: string, productId: string): Promise<StorefrontProductDetail | null> {
  try {
    const client = await createServerStorefrontApiClient();
    let ref = productId;
    if (!ref) {
      const { products } = await client.listStorefrontProducts(workspaceId, { limit: 1 });
      ref = products[0]?.id ?? "";
    }
    return ref ? await client.getStorefrontProduct(workspaceId, ref) : null;
  } catch {
    return null;
  }
}

function Title({ text }: { text: string }) {
  return text.trim() ? <h3 className="mb-3 text-lg font-semibold text-ink">{text}</h3> : null;
}

export async function BuilderExtraElement({
  type,
  props,
  workspaceId,
  editable = false,
}: {
  type: string;
  props: Props;
  workspaceId: string;
  editable?: boolean;
}) {
  const title = str(props, "title");

  if (type === "popup") {
    const trigger = str(props, "trigger");
    return (
      <PopupBlock
        popupKey={str(props, "key") || "popup"}
        title={title}
        text={str(props, "text")}
        image={safeUrl(str(props, "image"))}
        buttonLabel={str(props, "buttonLabel")}
        buttonHref={resolveHref(str(props, "buttonHref"))}
        trigger={trigger === "delay" || trigger === "exit" ? trigger : "click"}
        delaySeconds={num(props, "delaySeconds", 5, 1, 120)}
        editable={editable}
      />
    );
  }

  if (type === "image_gallery") {
    const own = (Array.isArray(props.images) ? props.images : []).map((u) => (typeof u === "string" ? safeUrl(u) : null)).filter((u): u is string => !!u);
    const product = own.length === 0 ? await productFor(workspaceId, str(props, "productId")) : null;
    const images = own.length > 0 ? own : product ? productImages(product) : [];
    if (images.length === 0) return null;
    return (
      <div>
        <Title text={title} />
        <GalleryWithThumbs images={images} alt={title || product?.name || ""} side={str(props, "thumbnails") === "side"} />
      </div>
    );
  }

  const product = await productFor(workspaceId, str(props, "productId"));
  if (!product) return null;

  if (type === "variant_selector") {
    if (product.variants.length < 2 && !product.variants.some((v) => Object.keys(v.optionValues ?? {}).length > 0)) return null;
    return (
      <div>
        <Title text={title} />
        <VariantChips productId={product.id} variants={product.variants} showPrice={bool(props, "showPrice", true)} />
      </div>
    );
  }

  if (type === "bundle_selector") {
    const tiers = bundleTiers(product).map((tier) => ({
      offerId: tier.offerId,
      label: tier.label || String(tier.quantity),
      quantity: tier.quantity,
      totalAmount: tier.totalAmount,
      discountPct: tier.discountPct,
      badge: tier.badge ?? null,
    }));
    if (tiers.length === 0) return null;
    return (
      <div>
        <Title text={title} />
        <BundleChoice productId={product.id} tiers={tiers} />
      </div>
    );
  }

  if (type === "review_form") {
    // Only while the store takes reviews (`store.reviews.open`): the title must not stand over nothing.
    const store = await getStoreMeta(workspaceId);
    if (store?.reviews?.open !== true) return null;
    return (
      <div>
        <Title text={title} />
        <ProductReviews workspaceId={workspaceId} productId={product.id} {...storefrontProductReviews(product)} formOnly />
      </div>
    );
  }

  return null;
}
