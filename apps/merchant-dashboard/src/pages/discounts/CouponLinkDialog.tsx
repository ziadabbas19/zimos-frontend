import { useMemo, useState } from "react";
import { IconCopy } from "@/components/icons";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { funnelsList, resolveCheckoutForm, type Discount } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useStoreProducts } from "../offers/OfferRuleParts";
import { funnelPreviewUrl, useStoreBaseUrl } from "../funnels/FunnelPublicLink";

const STRINGS = {
  en: {
    title: "Share link for {code}",
    description: "Whoever opens this link gets {code} applied at checkout, without typing it. It works on any page of the store and in funnels.",
    opensOn: "The link opens",
    home: "The store's home page",
    products: "A product page",
    funnels: "A funnel",
    onlyProducts: "This coupon only applies to some products, so the link opens one of them.",
    onlyFunnels: "This coupon only applies in some funnels, so the link opens one of them.",
    link: "Link",
    copy: "Copy link",
    copied: "Link copied.",
    inactive: "{code} isn't running now ({status}), so the link only applies it once it is active.",
    codesOff: "Coupons are switched off for your store (Store settings → Purchase form), so the link opens the store without a discount until you switch them back on.",
    noAddress: "Your store has no address yet, so there is no link to share.",
    close: "Close",
  },
  ar: {
    title: "رابط مشاركة {code}",
    description: "من يفتح هذا الرابط يُطبَّق له الكود {code} عند إتمام الطلب دون أن يكتبه. يعمل على أي صفحة في المتجر وفي مسارات البيع.",
    opensOn: "يفتح الرابط على",
    home: "الصفحة الرئيسية للمتجر",
    products: "صفحة منتج",
    funnels: "مسار بيع",
    onlyProducts: "هذا الكود يُطبَّق على منتجات محددة فقط، لذلك يفتح الرابط أحدها.",
    onlyFunnels: "هذا الكود يعمل في مسارات بيع محددة فقط، لذلك يفتح الرابط أحدها.",
    link: "الرابط",
    copy: "نسخ الرابط",
    copied: "تم نسخ الرابط.",
    inactive: "{code} غير مفعّل الآن ({status})، فلن يطبّقه الرابط إلا بعد تفعيله.",
    codesOff: "أكواد الخصم متوقفة في متجرك (إعدادات المتجر ← نموذج الشراء)، فسيفتح الرابط المتجر بدون خصم إلى أن تعيد تفعيلها.",
    noAddress: "ليس لمتجرك عنوان بعد، فلا يوجد رابط لمشاركته.",
    close: "إغلاق",
  },
} satisfies Messages;

interface Destination {
  value: string;
  label: string;
  url: string;
  group: "home" | "products" | "funnels";
}

/**
 * A coupon's share link: an address of the store that ends with
 * ?coupon=CODE. The storefront remembers the code from any
 * page of the store or a funnel and applies it at checkout
 * (storefront components/offers/CouponBits.tsx), so the link only needs a
 * place to land: the home page, a product, or a funnel — limited to the
 * products or funnels the coupon is restricted to, when it is.
 */
export function CouponLinkDialog({
  discount,
  statusText,
  onClose,
}: {
  discount: Discount | null;
  /** The coupon's status in words when it is not running now (disabled, scheduled, expired); null when it is. */
  statusText: string | null;
  onClose: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const { currentWorkspace } = useWorkspace();
  const open = discount !== null && Boolean(discount.code);
  const products = useStoreProducts();
  const funnels = useAsync(() => (open ? funnelsList(apiClient, workspaceId) : Promise.resolve([])), [workspaceId, open]);
  const [picked, setPicked] = useState<string | null>(null);

  const code = discount?.code ?? "";
  // The address shoppers know: the store's live domain when it has one, its own address otherwise.
  const base = useStoreBaseUrl() ?? "";
  const codesOn = resolveCheckoutForm(currentWorkspace?.settings?.checkout_settings).allow_discount_codes;
  const onlyFunnels = (discount?.funnelRestrictions ?? []).length > 0;
  const onlyProducts = !onlyFunnels && (discount?.productRestrictions ?? []).length > 0;

  const destinations = useMemo<Destination[]>(() => {
    if (!discount || !base) return [];
    const withCode = (url: string) => `${url}${url.includes("?") ? "&" : "?"}coupon=${encodeURIComponent(code)}`;
    const funnelOptions = (funnels.data ?? [])
      .filter((f) => (onlyFunnels ? discount.funnelRestrictions.includes(f.id) : f.status === "published"))
      // A funnel answers on its link only once it is published.
      .flatMap((f) => {
        const url = funnelPreviewUrl(base, f);
        return url ? [{ value: `funnel:${f.id}`, label: f.name, url: withCode(url), group: "funnels" as const }] : [];
      });
    if (onlyFunnels) return funnelOptions;
    const productOptions = (products.data ?? [])
      .filter((p) => (onlyProducts ? discount.productRestrictions.includes(p.id) : p.status === "active"))
      .map((p) => ({ value: `product:${p.id}`, label: p.name, url: withCode(`${base}/products/${p.slug}`), group: "products" as const }));
    if (onlyProducts) return productOptions;
    return [{ value: "home", label: t.home, url: withCode(`${base}/`), group: "home" as const }, ...productOptions, ...funnelOptions];
  }, [discount, base, code, funnels.data, products.data, onlyFunnels, onlyProducts, t.home]);

  const current = destinations.find((d) => d.value === picked) ?? destinations[0] ?? null;
  const loading = (onlyFunnels ? funnels.loading : products.loading) && destinations.length === 0;

  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.url);
      toast.success(t.copied);
    } catch {
      /* the link is on screen to select */
    }
  }

  const group = (name: Destination["group"], label: string) => {
    const items = destinations.filter((d) => d.group === name);
    if (items.length === 0) return null;
    const options = items.map((d) => (
      <option key={d.value} value={d.value}>
        {d.label}
      </option>
    ));
    return name === "home" ? options : <optgroup label={label}>{options}</optgroup>;
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPicked(null);
          onClose();
        }
      }}
      size="md"
      title={fmt(t.title, { code })}
      description={fmt(t.description, { code })}
      footer={
        <Button
          type="button"
          variant="outline"
          className="rounded-full px-5"
          onClick={() => {
            setPicked(null);
            onClose();
          }}
        >
          {t.close}
        </Button>
      }
    >
      {!base ? (
        <Alert variant="danger">{t.noAddress}</Alert>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-link-target">{t.opensOn}</Label>
            <Select
              id="coupon-link-target"
              value={current?.value ?? ""}
              disabled={loading || destinations.length === 0}
              onChange={(e) => setPicked(e.target.value)}
              className="h-11"
            >
              {group("home", t.home)}
              {group("products", t.products)}
              {group("funnels", t.funnels)}
            </Select>
            {onlyProducts && <p className="text-xs text-ink-soft">{t.onlyProducts}</p>}
            {onlyFunnels && <p className="text-xs text-ink-soft">{t.onlyFunnels}</p>}
          </div>
          {current && (
            <div className="space-y-1.5">
              <Label htmlFor="coupon-link-url">{t.link}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="coupon-link-url" dir="ltr" readOnly value={current.url} onFocus={(e) => e.target.select()} className="h-11 min-w-0 flex-1" />
                <Button type="button" className="min-h-11 shrink-0 rounded-full px-5" onClick={() => void copy()}>
                  <IconCopy className="size-4" aria-hidden />
                  {t.copy}
                </Button>
              </div>
            </div>
          )}
          {statusText && <Alert variant="danger">{fmt(t.inactive, { code, status: statusText })}</Alert>}
          {!codesOn && <Alert variant="danger">{t.codesOff}</Alert>}
        </div>
      )}
    </Sheet>
  );
}
