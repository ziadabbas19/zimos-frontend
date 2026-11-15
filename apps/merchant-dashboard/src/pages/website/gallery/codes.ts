import { useT, type Messages } from "@/i18n/LocaleContext";
import { humanize } from "@/lib/format";

/**
 * The words for the codes the API sends on this page: a site's status, a
 * template's category, and — per category — one line on what the template is
 * good for. A code the table lacks keeps its humanised English, as before.
 */
const CODES = {
  en: {
    "status.draft": "Draft",
    "status.published": "Published",
    "status.suspended": "Suspended",
    "status.changes": "Unpublished changes",
    "category.general": "General",
    "category.ecommerce": "Ecommerce",
    "category.fashion": "Fashion",
    "category.modest_fashion": "Modest fashion",
    "category.electronics": "Electronics",
    "category.phone_accessories": "Phone accessories",
    "category.food_beverage": "Food & drinks",
    "category.coffee": "Coffee",
    "category.perfume": "Perfume",
    "category.skincare": "Skincare",
    "category.supplements": "Supplements",
    "category.watches": "Watches",
    "category.jewellery": "Jewellery",
    "category.home_decor": "Home decor",
    "category.kids_toys": "Kids & toys",
    "category.single_product": "Single product",
    "goodFor.general": "A general template that suits any store.",
    "goodFor.ecommerce": "For a store with many products and categories.",
    "goodFor.fashion": "For clothing and fashion stores.",
    "goodFor.modest_fashion": "For abayas and modest wear.",
    "goodFor.electronics": "For electronics and devices.",
    "goodFor.phone_accessories": "For phone accessories.",
    "goodFor.food_beverage": "For food, drinks and sweets.",
    "goodFor.coffee": "For coffee and what goes with it.",
    "goodFor.perfume": "For perfume and incense.",
    "goodFor.skincare": "For skincare and beauty products.",
    "goodFor.supplements": "For supplements and health products.",
    "goodFor.watches": "For watch stores.",
    "goodFor.jewellery": "For jewellery and accessories.",
    "goodFor.home_decor": "For home decor and homeware.",
    "goodFor.kids_toys": "For toys and kids' things.",
    "goodFor.single_product": "For a store that sells one product.",
    goodForOther: "A ready-made start you can change freely.",
  },
  ar: {
    "status.draft": "مسودة",
    "status.published": "منشور",
    "status.suspended": "موقوف",
    "status.changes": "توجد تغييرات غير منشورة",
    "category.general": "عام",
    "category.ecommerce": "متجر إلكتروني",
    "category.fashion": "أزياء",
    "category.modest_fashion": "أزياء محتشمة",
    "category.electronics": "إلكترونيات",
    "category.phone_accessories": "إكسسوارات الهواتف",
    "category.food_beverage": "أطعمة ومشروبات",
    "category.coffee": "قهوة",
    "category.perfume": "عطور",
    "category.skincare": "العناية بالبشرة",
    "category.supplements": "مكمّلات غذائية",
    "category.watches": "ساعات",
    "category.jewellery": "مجوهرات",
    "category.home_decor": "ديكور المنزل",
    "category.kids_toys": "ألعاب أطفال",
    "category.single_product": "منتج واحد",
    "goodFor.general": "قالب عام يصلح لأي متجر.",
    "goodFor.ecommerce": "لمتجر فيه منتجات وأقسام كثيرة.",
    "goodFor.fashion": "لمتاجر الملابس والأزياء.",
    "goodFor.modest_fashion": "لمتاجر العبايات وملابس المحجبات.",
    "goodFor.electronics": "لمتاجر الإلكترونيات والأجهزة.",
    "goodFor.phone_accessories": "لمتاجر إكسسوارات الهواتف.",
    "goodFor.food_beverage": "للأطعمة والمشروبات والحلويات.",
    "goodFor.coffee": "لمتاجر القهوة ومستلزماتها.",
    "goodFor.perfume": "لمتاجر العطور والبخور.",
    "goodFor.skincare": "لمنتجات العناية بالبشرة والتجميل.",
    "goodFor.supplements": "للمكمّلات ومنتجات الصحة.",
    "goodFor.watches": "لمتاجر الساعات.",
    "goodFor.jewellery": "للمجوهرات والإكسسوارات.",
    "goodFor.home_decor": "لديكور المنزل ومستلزماته.",
    "goodFor.kids_toys": "لألعاب الأطفال ومستلزماتهم.",
    "goodFor.single_product": "لمتجر يبيع منتجًا واحدًا.",
    goodForOther: "بداية جاهزة تعدّلها كما تريد.",
  },
} satisfies Messages;

export type CodeGroup = "category" | "status" | "goodFor";

/** `(group, code) => words` in the dashboard's language. */
export function useCodeLabel(): (group: CodeGroup, code: string | null | undefined) => string {
  const t = useT(CODES);
  return (group, code) => {
    const known = code ? (t as Record<string, string>)[`${group}.${code}`] : undefined;
    if (known) return known;
    if (group === "goodFor") return t.goodForOther;
    return humanize(code);
  };
}
