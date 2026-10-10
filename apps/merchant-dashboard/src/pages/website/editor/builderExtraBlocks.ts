import { AppWindow, Images, LayoutDashboard, Layers3, MessageSquarePlus, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { PageElementType } from "@store-builder/api-client";
import type { BlockPreset, FieldSpec, SectionSettingSpec } from "./blocks";

/**
 * Builder elements added after the first set (SPEC §9.3, item 44; backend
 * pages/builderExtras.js, storefront page-renderer/builderExtras.tsx): a
 * gallery with thumbnails, the product's variant and bundle pickers, and the
 * shopper's review form. Merged into ELEMENT_SPECS / BLOCK_PRESETS and the
 * Arabic labels from here, as showcaseBlocks.ts is.
 */

type Spec = { label: string; icon: LucideIcon; defaultProps: Record<string, unknown>; fields: FieldSpec[] };

const PRODUCT_FIELD: FieldSpec = { key: "productId", label: "Product", kind: "product", hint: "Leave empty to use the page's product (else the newest)." };

export const EXTRA_ELEMENT_SPECS: Record<string, Spec> = {
  image_gallery: {
    label: "Gallery with thumbnails",
    icon: Images,
    defaultProps: { title: "", images: [], productId: "", thumbnails: "below" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "images", label: "Images", kind: "imageList", hint: "Empty shows the product's own pictures." },
      PRODUCT_FIELD,
      {
        key: "thumbnails",
        label: "Thumbnails",
        kind: "select",
        options: [
          { value: "below", label: "Below the picture" },
          { value: "side", label: "Beside the picture" },
        ],
      },
    ],
  },
  variant_selector: {
    label: "Variant picker",
    icon: SlidersHorizontal,
    defaultProps: { title: "", productId: "", showPrice: true },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      PRODUCT_FIELD,
      { key: "showPrice", label: "Show the chosen option's price and stock", kind: "boolean" },
    ],
  },
  bundle_selector: {
    label: "Bundle picker",
    icon: Layers3,
    defaultProps: { title: "", productId: "" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { ...PRODUCT_FIELD, hint: "Shows the product's quantity offers (Offers → Quantity offers). Leave empty for the page's product." },
    ],
  },
  popup: {
    label: "Popup",
    icon: AppWindow,
    defaultProps: { key: "offer", title: "", text: "", image: "", buttonLabel: "", buttonHref: "", trigger: "click", delaySeconds: 5 },
    fields: [
      { key: "key", label: "Popup name", kind: "text", hint: "Lowercase letters, digits and hyphens. Any button or link to #popup-<name> opens it." },
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      { key: "image", label: "Image", kind: "image" },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "buttonHref", label: "Button link", kind: "text" },
      {
        key: "trigger",
        label: "Also opens",
        kind: "select",
        options: [
          { value: "click", label: "Only from a link" },
          { value: "delay", label: "After a few seconds (once a visit)" },
          { value: "exit", label: "When leaving the page (once a visit)" },
        ],
      },
      { key: "delaySeconds", label: "Seconds before it opens", kind: "number", min: 1, max: 120 },
    ],
  },
  masonry_grid: {
    label: "Masonry grid",
    icon: LayoutDashboard,
    defaultProps: { title: "", items: [], columns: 3 },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      {
        key: "items",
        label: "Pictures",
        kind: "itemList",
        itemLabel: "Picture",
        itemLabelAr: "صورة",
        titleKey: "caption",
        max: 40,
        fields: [
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
          { key: "caption", label: "Caption", labelAr: "التعليق", kind: "text" },
          { key: "href", label: "Links to", labelAr: "الرابط", kind: "text", ltr: true },
        ],
      },
      { key: "columns", label: "Columns on a computer", kind: "number", min: 2, max: 5 },
    ],
  },
  review_form: {
    label: "Review form",
    icon: MessageSquarePlus,
    defaultProps: { title: "", productId: "" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { ...PRODUCT_FIELD, hint: "Customers who received the product review it with their order number and phone. Reviews wait for your approval." },
    ],
  },
};

const t = (type: string) => type as PageElementType;

export const EXTRA_PRESETS: BlockPreset[] = [
  {
    key: "image-gallery",
    label: "Gallery with thumbnails",
    description: "A big picture with a row of thumbnails — the product's own pictures unless you add some.",
    icon: Images,
    group: "commerce",
    elements: [t("image_gallery")],
  },
  {
    key: "variant-selector",
    label: "Variant picker",
    description: "The product's options (size, colour…) as buttons. The order form starts from the shopper's choice.",
    icon: SlidersHorizontal,
    group: "commerce",
    elements: [t("variant_selector")],
  },
  {
    key: "bundle-selector",
    label: "Bundle picker",
    description: "The product's quantity offers to choose from, with the saving.",
    icon: Layers3,
    group: "commerce",
    elements: [t("bundle_selector")],
  },
  {
    key: "popup",
    label: "Popup",
    description: "A window over the page — opened by a button linking to #popup-<name>, after a few seconds, or when leaving.",
    icon: AppWindow,
    group: "convert",
    elements: [t("popup")],
  },
  {
    key: "masonry-grid",
    label: "Masonry grid",
    description: "Pictures of different heights in neat columns, each with an optional caption and link.",
    icon: LayoutDashboard,
    group: "story",
    elements: [t("masonry_grid")],
  },
];

/**
 * Item 93: what a button does (follow its link, add the product to the cart,
 * or buy it now) and a form's photo and stars inputs — appended to the
 * button's and the form's fields in blocks.ts.
 */
export const BUTTON_ACTION_FIELDS: FieldSpec[] = [
  {
    key: "action",
    label: "When pressed",
    kind: "select",
    options: [
      { value: "link", label: "Open its link" },
      { value: "add_to_cart", label: "Add the product to the cart" },
      { value: "buy_now", label: "Buy now (add and go to checkout)" },
    ],
  },
  { ...PRODUCT_FIELD, hint: "For add to cart / buy now. Leave empty for the page's product. The variant is the one picked on the page." },
  { key: "variantId", label: "Variant ID", kind: "text", hint: "Optional: the variant added when the shopper picked none. Else the first in stock." },
];

export const FORM_INPUT_FIELDS: FieldSpec[] = [
  { key: "ratingLabel", label: "Stars input — its label", kind: "text", hint: "1 to 5 stars. Empty = no stars input." },
  { key: "fileLabel", label: "Photo input — its label", kind: "text", hint: "The shopper attaches one photo (JPEG, PNG or WebP). Empty = no photo input." },
  { key: "fileRequired", label: "The photo is required", kind: "boolean" },
];

/**
 * A column is the "container" of SPEC §9.3: its items stacked or side by
 * side (wrapping), the gap between them and how a row of them lines up.
 */
export const COLUMN_LAYOUT_SPECS: SectionSettingSpec[] = [
  {
    key: "layout",
    label: "Items",
    defaultValue: "stack",
    options: [
      { value: "stack", label: "Stacked" },
      { value: "inline", label: "Side by side" },
    ],
  },
  {
    key: "itemGap",
    label: "Space between items",
    defaultValue: "normal",
    options: [
      { value: "tight", label: "Tight" },
      { value: "normal", label: "Normal" },
      { value: "loose", label: "Loose" },
    ],
  },
  {
    key: "justify",
    label: "Side by side: line up",
    defaultValue: "start",
    options: [
      { value: "start", label: "At the start" },
      { value: "center", label: "Centred" },
      { value: "between", label: "Spread out" },
      { value: "end", label: "At the end" },
    ],
  },
  {
    key: "sticky",
    label: "Sticky while scrolling",
    defaultValue: "none",
    options: [
      { value: "none", label: "No" },
      { value: "top", label: "Yes — at the top" },
      { value: "header", label: "Yes — below the store header" },
    ],
  },
];

export const EXTRA_AR = {
  sectionLabels: { layout: "العناصر", itemGap: "المسافة بين العناصر", justify: "جنب بعض: الترتيب", sticky: "ثابت أثناء التمرير" } as Record<string, string>,
  sectionOptions: {
    "layout.stack": "تحت بعض",
    "layout.inline": "جنب بعض",
    "itemGap.tight": "ضيقة",
    "itemGap.normal": "عادية",
    "itemGap.loose": "واسعة",
    "justify.start": "من البداية",
    "justify.center": "في النص",
    "justify.between": "موزّعة",
    "justify.end": "من النهاية",
    "sticky.none": "لا",
    "sticky.top": "أيوه — في أعلى الشاشة",
    "sticky.header": "أيوه — تحت هيدر المتجر",
  } as Record<string, string>,
  elements: {
    image_gallery: "معرض صور بمصغّرات",
    variant_selector: "اختيار النوع",
    bundle_selector: "اختيار العرض",
    review_form: "فورم التقييم",
    popup: "نافذة منبثقة",
    masonry_grid: "شبكة صور متفاوتة",
  } as Record<string, string>,
  fields: {
    "image_gallery.thumbnails": "المصغّرات",
    "variant_selector.showPrice": "اعرض سعر ومخزون النوع المختار",
    "popup.key": "اسم النافذة",
    "popup.trigger": "تتفتح كمان",
    "popup.delaySeconds": "ثواني قبل ما تتفتح",
    "popup.buttonHref": "رابط الزرار",
    "masonry_grid.items": "الصور",
    "masonry_grid.columns": "الأعمدة على الكمبيوتر",
    "button.action": "لما يتضغط",
    "button.productId": "المنتج",
    "button.variantId": "معرّف النوع",
    "form.ratingLabel": "تقييم بالنجوم — عنوانه",
    "form.fileLabel": "رفع صورة — عنوانه",
    "form.fileRequired": "الصورة مطلوبة",
  } as Record<string, string>,
  hints: {
    "image_gallery.images": "لو فاضي بيعرض صور المنتج نفسه.",
    "image_gallery.productId": "سيبه فاضي عشان يستخدم منتج الصفحة (أو الأحدث).",
    "variant_selector.productId": "سيبه فاضي عشان يستخدم منتج الصفحة (أو الأحدث).",
    "bundle_selector.productId": "بيعرض عروض الكمية بتاعة المنتج (العروض ← عروض الكمية). سيبه فاضي لمنتج الصفحة.",
    "review_form.productId": "العملاء اللي استلموا المنتج بيقيّموه برقم الطلب والموبايل. التقييمات بتستنى موافقتك.",
    "popup.key": "حروف إنجليزي صغيرة وأرقام وشرطات. أي زرار أو لينك على #popup-<الاسم> بيفتحها.",
    "button.productId": "لإضافة للسلة / اشتري الآن. سيبه فاضي لمنتج الصفحة. النوع هو اللي العميل اختاره في الصفحة.",
    "button.variantId": "اختياري: النوع اللي يتضاف لو العميل مااختارش. غير كده أول نوع متوفر.",
    "form.ratingLabel": "من 1 لـ 5 نجوم. فاضي = من غير تقييم.",
    "form.fileLabel": "العميل يرفق صورة واحدة (JPEG أو PNG أو WebP). فاضي = من غير رفع صورة.",
  } as Record<string, string>,
  options: {
    "thumbnails.below": "تحت الصورة",
    "thumbnails.side": "جنب الصورة",
    "trigger.click": "من لينك بس",
    "trigger.delay": "بعد كام ثانية (مرة في الزيارة)",
    "trigger.exit": "لما العميل يسيب الصفحة (مرة في الزيارة)",
    "action.link": "يفتح الرابط بتاعه",
    "action.add_to_cart": "يضيف المنتج للسلة",
    "action.buy_now": "اشتري الآن (يضيف ويروح للدفع)",
  } as Record<string, string>,
  presets: {
    "image-gallery": { label: "معرض صور بمصغّرات", description: "صورة كبيرة وتحتها صف مصغّرات — صور المنتج نفسه لو ماضفتش صور." },
    "variant-selector": { label: "اختيار النوع", description: "أنواع المنتج (المقاس، اللون…) كأزرار. فورم الطلب بيبدأ من اختيار العميل." },
    "bundle-selector": { label: "اختيار العرض", description: "عروض الكمية بتاعة المنتج يختار منها العميل، مع التوفير." },
    "review-form": { label: "فورم التقييم", description: "يخلّي العملاء اللي استلموا المنتج يقيّموه، بالصور." },
    "masonry-grid": { label: "شبكة صور متفاوتة", description: "صور بأطوال مختلفة في أعمدة مرتبة، لكل صورة تعليق ورابط اختياري." },
    popup: { label: "نافذة منبثقة", description: "نافذة فوق الصفحة — بتتفتح من زرار لينكه #popup-<الاسم>، أو بعد كام ثانية، أو لما العميل يسيب الصفحة." },
  } as Record<string, { label: string; description: string }>,
};
