import { useMemo } from "react";
import { IconPercent, IconPlug, IconShipping, IconSliders } from "@/components/icons";
import type { SettingsSectionDef } from "@/components/settings";
import { useT, type Messages } from "@/i18n/LocaleContext";

export const SHIPPING_SECTION_STRINGS = {
  en: {
    rates: "Shipping prices",
    options: "Shipping options",
    carriers: "Shipping companies",
    taxes: "Taxes",
    ratesHint: "The default price, delivery areas, your own couriers, working hours and zones.",
    optionsHint: "The ways of delivery a shopper chooses between at checkout.",
    carriersHint: "The courier companies your store books shipments with.",
    taxesHint: "Whether tax is charged, and the rates applied at checkout.",
    search: "Search the shipping settings…",
  },
  ar: {
    rates: "أسعار الشحن",
    options: "خيارات الشحن",
    carriers: "شركات الشحن",
    taxes: "الضرائب",
    ratesHint: "السعر الافتراضي، مناطق التوصيل، المناديب، ساعات العمل والمناطق.",
    optionsHint: "طرق التوصيل التي يختار العميل بينها عند إتمام الشراء.",
    carriersHint: "شركات الشحن التي يحجز متجرك شحناته معها.",
    taxesHint: "هل تُحتسب ضريبة، والنسب التي تُطبَّق عند إتمام الشراء.",
    search: "ابحث في إعدادات الشحن…",
  },
} satisfies Messages;

export const SHIPPING_TABS = ["rates", "options", "carriers", "taxes"] as const;
export type ShippingTab = (typeof SHIPPING_TABS)[number];

export const SHIPPING_ICONS = { rates: IconShipping, options: IconSliders, carriers: IconPlug, taxes: IconPercent } as const;
const TONES = { rates: "blue", options: "purple", carriers: "orange", taxes: "green" } as const;

/** What the search also finds each section by, in both languages: the list's own search and the dashboard's (lib/search/siteIndex.ts). */
export const SHIPPING_KEYWORDS: Record<ShippingTab, readonly string[]> = {
  rates: ["shipping price", "delivery fee", "governorates", "delivery areas", "zones", "couriers", "pickup", "working hours", "سعر الشحن", "مصاريف الشحن", "المحافظات", "مناطق التوصيل", "المناديب", "الاستلام من المتجر", "ساعات العمل"],
  options: ["delivery options", "express", "standard", "free shipping", "طرق التوصيل", "شحن مجاني", "سريع"],
  carriers: ["bosta", "j&t", "courier company", "waybill", "بوسطة", "شركة شحن", "بوليصة"],
  taxes: ["tax", "vat", "rates", "ضريبة", "القيمة المضافة", "ضرائب"],
};

/**
 * The shipping page's sections, kept in the URL (?tab=, the values it always
 * had) so a link opens the right one. With none in the address a desktop opens
 * the first and a phone shows the list.
 */
export function useShippingSections(): { sections: SettingsSectionDef[]; searchPlaceholder: string } {
  const t = useT(SHIPPING_SECTION_STRINGS);
  const sections = useMemo<SettingsSectionDef[]>(
    () =>
      SHIPPING_TABS.map((id) => ({
        id,
        label: t[id],
        description: t[`${id}Hint`],
        icon: SHIPPING_ICONS[id],
        tone: TONES[id],
        keywords: [...SHIPPING_KEYWORDS[id]],
      })),
    [t]
  );
  return { sections, searchPlaceholder: t.search };
}

/** The section an id names; anything else (or none) reads as the first. */
export function shippingTabOf(id: string | null): ShippingTab {
  return (SHIPPING_TABS as readonly string[]).includes(id ?? "") ? (id as ShippingTab) : "rates";
}
