import type { ProfitEconomics } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";
import { basisPointsToPercentInput, majorToMinor, minorToMajorInput, percentToBasisPoints } from "@/lib/format";

/** The words of the costs page (/profit/costs): the store defaults, the products and a product's own costs. */
export const COSTS_STRINGS = {
  en: {
    title: "Costs",
    description: "What every order really costs you. The profit report uses these numbers; a product can have its own.",
    back: "Real profit",

    perOrderTitle: "Shipping and packaging",
    ratesTitle: "Fees and losses",
    defaultsNote: "Store defaults: used for every product that has no values of its own.",
    shipping: "Courier charge per order",
    shippingHint: "What the courier charges you, not what the customer pays",
    returnCost: "Return charge per order",
    returnHint: "What the courier charges you when an order comes back",
    packaging: "Packaging per piece",
    packagingHint: "The box, the bag, the sticker",
    collection: "Cash-on-delivery collection fee",
    collectionHint: "The courier's share of the cash it collects",
    gateway: "Online payment fee",
    gatewayHint: "The gateway's share of a card or wallet payment",
    damage: "Damaged or lost",
    damageHint: "Share of the unit cost written off",
    saved: "Costs saved.",
    invalidMoney: "Type the amount in digits only, with no letters or symbols.",
    invalidPercent: "Type a percentage between zero and a hundred.",
    fixFields: "Fix the marked fields, then save.",

    productsTitle: "Products",
    productsDesc: "Unit cost comes from each product's variants. Change the other costs only for a product that differs.",
    searchLabel: "Search the products",
    searchPlaceholder: "Product name",
    chipsLabel: "Products by cost",
    chipAll: "All",
    chipNoCost: "No unit cost",
    chipCustom: "Custom costs",
    colProduct: "Product",
    colUnitCost: "Unit cost",
    colPrice: "Price",
    colCosts: "Other costs",
    colAction: "Edit",
    usesDefaults: "Store defaults",
    custom: "Custom",
    missingCost: "No unit cost",
    someMissing_one: "1 variant without cost",
    someMissing_other: "{n} variants without cost",
    edit: "Edit",
    editCosts: "Edit the costs",
    openProduct: "Open the product",
    setUnitCost: "Set unit cost",
    menuLabel: "Actions for this product",
    noProducts: "No products yet",
    noProductsHint: "Add your first product, then come back to say what it costs you.",
    addProduct: "Add a product",
    noMatch: "No product matches",
    clearAll: "Clear the search and the filter",

    editTitle: "Costs for {name}",
    editDesc: "Leave a field empty to use the store default.",
    unitCostWhere: "The unit cost is typed on the product's own page.",
    reset: "Use store defaults",
    resetDone: "{name} now uses the store defaults.",
    working: "Working…",
  },
  ar: {
    title: "التكاليف",
    description: "ما يكلّفك كل طلب فعلًا. تقرير الأرباح يعتمد على هذه الأرقام، ويمكن أن تكون لأي منتج أرقامه الخاصة.",
    back: "الأرباح الحقيقية",

    perOrderTitle: "الشحن والتغليف",
    ratesTitle: "الرسوم والهالك",
    defaultsNote: "افتراضيات المتجر: تُحتسب لكل منتج ليست له أرقام خاصة.",
    shipping: "تكلفة الشحن لكل طلب",
    shippingHint: "ما تحاسبك عليه شركة الشحن، لا ما يدفعه العميل",
    returnCost: "تكلفة المرتجع لكل طلب",
    returnHint: "ما تأخذه شركة الشحن عند رجوع الطلب",
    packaging: "التغليف لكل قطعة",
    packagingHint: "العلبة والكيس والملصق",
    collection: "رسوم التحصيل عند الاستلام",
    collectionHint: "نسبة شركة الشحن من المبلغ الذي تحصّله",
    gateway: "رسوم الدفع الإلكتروني",
    gatewayHint: "نسبة بوابة الدفع من البطاقة أو المحفظة",
    damage: "التالف أو المفقود",
    damageHint: "نسبة من تكلفة القطعة تُحتسب خسارة",
    saved: "تم حفظ التكاليف.",
    invalidMoney: "اكتب المبلغ بالأرقام فقط، بلا حروف ولا رموز.",
    invalidPercent: "اكتب نسبة من صفر إلى مئة.",
    fixFields: "صحّح الحقول المعلَّمة ثم احفظ.",

    productsTitle: "المنتجات",
    productsDesc: "تكلفة القطعة تأتي من أنواع كل منتج. غيّر باقي التكاليف فقط للمنتج الذي يختلف.",
    searchLabel: "ابحث في المنتجات",
    searchPlaceholder: "اسم المنتج",
    chipsLabel: "المنتجات حسب التكلفة",
    chipAll: "الكل",
    chipNoCost: "بدون تكلفة",
    chipCustom: "تكاليف خاصة",
    colProduct: "المنتج",
    colUnitCost: "تكلفة القطعة",
    colPrice: "السعر",
    colCosts: "باقي التكاليف",
    colAction: "تعديل",
    usesDefaults: "افتراضيات المتجر",
    custom: "خاصة",
    missingCost: "بدون تكلفة",
    someMissing_one: "نوع واحد بدون تكلفة",
    someMissing_two: "نوعان بدون تكلفة",
    someMissing_few: "{n} أنواع بدون تكلفة",
    someMissing_other: "{n} نوعًا بدون تكلفة",
    edit: "تعديل",
    editCosts: "تعديل التكاليف",
    openProduct: "فتح المنتج",
    setUnitCost: "حدّد تكلفة القطعة",
    menuLabel: "إجراءات المنتج",
    noProducts: "لا توجد منتجات بعد",
    noProductsHint: "أضف أول منتج، ثم عد لتحديد تكلفته.",
    addProduct: "إضافة منتج",
    noMatch: "لا يوجد منتج مطابق",
    clearAll: "مسح البحث والفلتر",

    editTitle: "تكاليف {name}",
    editDesc: "اترك الحقل فارغًا ليُحتسب بافتراضي المتجر.",
    unitCostWhere: "تكلفة القطعة تُكتب في صفحة المنتج نفسه.",
    reset: "العودة إلى افتراضيات المتجر",
    resetDone: "أصبح {name} يُحتسب بافتراضيات المتجر.",
    working: "لحظة واحدة…",
  },
} satisfies Messages;

export type CostsStrings = (typeof COSTS_STRINGS)["en"];
export type CostsKey = keyof CostsStrings;

export type CostField = keyof ProfitEconomics;
/** The six costs as typed: major units for the amounts, percent for the rates. Empty means "not set". */
export type CostForm = Record<CostField, string>;
export type CostKind = "money" | "percent";
export type CostErrors = Partial<Record<CostField, CostKind>>;

export interface CostFieldMeta {
  field: CostField;
  kind: CostKind;
  label: CostsKey;
  hint: CostsKey;
}

/** The amounts, in the order they are asked. */
export const MONEY_META: readonly CostFieldMeta[] = [
  { field: "shippingCostAmount", kind: "money", label: "shipping", hint: "shippingHint" },
  { field: "returnCostAmount", kind: "money", label: "returnCost", hint: "returnHint" },
  { field: "packagingCostAmount", kind: "money", label: "packaging", hint: "packagingHint" },
];

/** The rates, in the order they are asked. */
export const PERCENT_META: readonly CostFieldMeta[] = [
  { field: "collectionFeeBp", kind: "percent", label: "collection", hint: "collectionHint" },
  { field: "gatewayFeeBp", kind: "percent", label: "gateway", hint: "gatewayHint" },
  { field: "damageBp", kind: "percent", label: "damage", hint: "damageHint" },
];

export const COST_META: readonly CostFieldMeta[] = [...MONEY_META, ...PERCENT_META];

export function toForm(economics: ProfitEconomics | null): CostForm {
  return {
    packagingCostAmount: minorToMajorInput(economics?.packagingCostAmount),
    shippingCostAmount: minorToMajorInput(economics?.shippingCostAmount),
    returnCostAmount: minorToMajorInput(economics?.returnCostAmount),
    collectionFeeBp: basisPointsToPercentInput(economics?.collectionFeeBp),
    gatewayFeeBp: basisPointsToPercentInput(economics?.gatewayFeeBp),
    damageBp: basisPointsToPercentInput(economics?.damageBp),
  };
}

export function sameForm(a: CostForm, b: CostForm): boolean {
  return COST_META.every((meta) => a[meta.field].trim() === b[meta.field].trim());
}

/**
 * What the form says, as the API takes it: empty = null (use the default),
 * an amount in minor units, a rate in basis points. The rules are the page's
 * old ones — an amount is a number that is not negative, a rate is between
 * 0 and 100% — but each field that breaks one is named, instead of one toast
 * for the whole form. `payload` is null while any field is wrong.
 */
export function readForm(form: CostForm): { payload: ProfitEconomics | null; errors: CostErrors } {
  const out = {} as ProfitEconomics;
  const errors: CostErrors = {};
  for (const meta of COST_META) {
    const raw = form[meta.field].trim();
    if (raw === "") {
      out[meta.field] = null;
      continue;
    }
    if (meta.kind === "money") {
      const value = majorToMinor(raw);
      if (!Number.isFinite(value) || value < 0) errors[meta.field] = "money";
      else out[meta.field] = value;
    } else {
      const value = percentToBasisPoints(raw);
      if (!Number.isFinite(value) || value < 0 || value > 10000) errors[meta.field] = "percent";
      else out[meta.field] = value;
    }
  }
  return { payload: Object.keys(errors).length > 0 ? null : out, errors };
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * A phone set to Arabic types «٣٥٫٥»; the fields read "35.5". The digits and
 * the Arabic decimal mark are turned as they are typed, so the number means
 * the same and the field does not refuse a keyboard for its language.
 */
export function toLatinDigits(text: string): string {
  let out = "";
  for (const char of text) {
    const arabic = ARABIC_DIGITS.indexOf(char);
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (arabic >= 0) out += String(arabic);
    else if (persian >= 0) out += String(persian);
    else if (char === "٫") out += ".";
    else out += char;
  }
  return out;
}
