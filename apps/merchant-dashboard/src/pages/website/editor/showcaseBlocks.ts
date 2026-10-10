import { IconCarousel, IconClick, IconFilm, IconGridDense, IconGridView, IconOrders, IconPanelTop, IconRows, IconShield, IconVideoBlock, type IconComponent } from "@/components/icons";
import type { PageElementType } from "@store-builder/api-client";
import { HERO_MEDIA_ENABLED } from "@/lib/features";
import type { BlockPreset, FieldSpec } from "./blocks";
import type { ItemSubField } from "./ItemListField";

/**
 * The showcase sections in the editor: what the inspector offers for each of
 * the ten full-width storefront bands (backend showcaseElements.js, storefront
 * page-renderer/showcase), and the ready-made block each one is added as.
 *
 * Kept beside blocks.ts rather than in it so that file only gains the spreads
 * that register these. The lists inside a band — slides, tiles, trust cards,
 * needs, videos — are edited as cards (the "itemList" field, ItemListField.tsx).
 */

export const SHOWCASE_TYPES = [
  "hero_slider",
  "category_tiles",
  "trust_strip",
  "bundle_cards",
  "need_picker",
  "product_rail",
  "video_reels",
  "product_shelf",
  "product_cards",
  "image_banner",
] as const satisfies readonly PageElementType[];

type ShowcaseType = (typeof SHOWCASE_TYPES)[number];

interface ShowcaseSpec {
  label: string;
  icon: IconComponent;
  defaultProps: Record<string, unknown>;
  fields: FieldSpec[];
}

const TONE: FieldSpec = {
  key: "tone",
  label: "Background",
  kind: "select",
  options: [
    { value: "plain", label: "Plain" },
    { value: "primary", label: "Brand tint" },
    { value: "secondary", label: "Second colour tint" },
    { value: "cool", label: "Cool tint" },
  ],
};

const COLLECTION: FieldSpec = {
  key: "collection",
  label: "Collection",
  kind: "text",
  placeholder: "best-seller",
  hint: "The collection's address name (slug). Leave empty for the newest products.",
};

/** Heading, collection, how many, the button under the band and the cart wording. */
const productBand = (limit: number): FieldSpec[] => [
  { key: "heading", label: "Heading", kind: "text" },
  { key: "subheading", label: "Line under the heading", kind: "text" },
  COLLECTION,
  { key: "limit", label: "How many", kind: "number", min: 1, max: 24, hint: `Starts at ${limit}.` },
  { key: "showDiscount", label: "Show the discount", kind: "boolean" },
  { key: "buttonLabel", label: "Button text", kind: "text" },
  { key: "buttonHref", label: "Button links to", kind: "text", placeholder: "/products" },
  { key: "cartLabel", label: "Add-to-cart wording", kind: "text", hint: "Leave empty for the store's own wording." },
  TONE,
];

/** Where a slide's text sits, across and up-and-down: the same three places on a computer and on a phone. */
const SLIDE_SIDES = [
  { value: "start", label: "Start", labelAr: "البداية" },
  { value: "center", label: "Centre", labelAr: "الوسط" },
  { value: "end", label: "End", labelAr: "النهاية" },
];
const SLIDE_HEIGHTS = [
  { value: "top", label: "Top", labelAr: "فوق" },
  { value: "middle", label: "Middle", labelAr: "النص" },
  { value: "bottom", label: "Bottom", labelAr: "تحت" },
];

/** The first choice of a phone's own setting: it stores nothing, and the store then uses the computer's value. */
const SAME_AS_COMPUTER = { label: "Same as on a computer", labelAr: "كما على الكمبيوتر" };

/**
 * A slide's settings behind the HERO_MEDIA switch (lib/features): the text's
 * place on a phone and the veil over the picture. They are plain props of the
 * slide (the storefront reads them in showcase/heroLook.ts), so the server
 * stores them as they are. Off, the editor offers none of them.
 */
const HERO_MEDIA_SLIDE_FIELDS: ItemSubField[] = HERO_MEDIA_ENABLED
  ? [
      { key: "sideMobile", label: "Text sits at, on a phone", labelAr: "مكان النص على الموبايل", kind: "choice", unset: SAME_AS_COMPUTER, options: SLIDE_SIDES },
      { key: "verticalMobile", label: "Text height, on a phone", labelAr: "ارتفاع النص على الموبايل", kind: "choice", unset: SAME_AS_COMPUTER, options: SLIDE_HEIGHTS },
      {
        key: "overlay",
        label: "Veil over the picture (%)",
        labelAr: "طبقة فوق الصورة (%)",
        kind: "number",
        min: 0,
        max: 60,
        step: 5,
        startAt: 0,
        hint: "Makes the text easier to read: dark under light text, light under dark text. Empty or 0 leaves the picture as it is.",
        hintAr: "تسهّل قراءة النص: داكنة تحت النص الفاتح، وفاتحة تحت النص الداكن. الفراغ أو الصفر يترك الصورة كما هي.",
      },
      {
        key: "overlayMobile",
        label: "Veil on a phone (%)",
        labelAr: "الطبقة على الموبايل (%)",
        kind: "number",
        min: 0,
        max: 60,
        step: 5,
        hint: "Leave empty to use the same strength as on a computer.",
        hintAr: "اتركه فارغًا لاستخدام القوة نفسها التي على الكمبيوتر.",
      },
    ]
  : [];

export const SHOWCASE_ELEMENT_SPECS: Record<ShowcaseType, ShowcaseSpec> = {
  hero_slider: {
    label: "Picture slider",
    icon: IconCarousel,
    defaultProps: { slides: [], autoplay: true, seconds: 5, startDelay: 5, arrows: true, dots: true, wave: true, height: 620, heightTablet: 520 },
    fields: [
      {
        key: "slides",
        label: "Slides",
        kind: "itemList",
        itemLabel: "Slide",
        itemLabelAr: "شريحة",
        titleKey: "alt",
        max: 8,
        fields: [
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
          { key: "mobileImage", label: "Picture on a phone", labelAr: "الصورة على الموبايل", kind: "image" },
          { key: "imageEn", label: "Picture (English store)", labelAr: "الصورة (النسخة الإنجليزية)", kind: "image" },
          { key: "mobileImageEn", label: "Phone picture (English store)", labelAr: "صورة الموبايل (النسخة الإنجليزية)", kind: "image" },
          { key: "alt", label: "Describes the picture", labelAr: "وصف الصورة", kind: "text" },
          { key: "eyebrow", label: "Small line above the heading", labelAr: "سطر صغير فوق العنوان", kind: "text" },
          { key: "heading", label: "Heading", labelAr: "العنوان", kind: "text" },
          { key: "subheading", label: "Line under it", labelAr: "السطر تحته", kind: "text" },
          { key: "buttonLabel", label: "Button text", labelAr: "نص الزرار", kind: "text" },
          { key: "buttonLabelEn", label: "Button text (English)", labelAr: "نص الزرار (إنجليزي)", kind: "text" },
          { key: "buttonHref", label: "Button links to", labelAr: "رابط الزرار", kind: "text", ltr: true },
          { key: "side", label: "Text sits at", labelAr: "مكان النص", kind: "select", options: SLIDE_SIDES },
          { key: "vertical", label: "Text height", labelAr: "ارتفاع النص", kind: "select", options: SLIDE_HEIGHTS },
          ...HERO_MEDIA_SLIDE_FIELDS,
          {
            key: "text",
            label: "Text colour",
            labelAr: "لون النص",
            kind: "choice",
            fallback: "dark",
            options: [
              { value: "dark", label: "Dark", labelAr: "داكن" },
              { value: "light", label: "Light", labelAr: "فاتح" },
            ],
            hint: "Light suits a dark picture, dark a bright one.",
            hintAr: "الفاتح يناسب الصورة الداكنة، والداكن يناسب الصورة الفاتحة.",
          },
          {
            key: "contentWidth",
            label: "Text width (px)",
            labelAr: "عرض النص (بكسل)",
            kind: "number",
            min: 200,
            // The server takes up to 900, but the store never draws the text block wider than 600 (store-sections.css).
            max: 600,
            step: 20,
            startAt: 600,
            hint: "The widest the text block may get. Leave empty for the store's own width.",
            hintAr: "أقصى عرض لمساحة النص. اتركه فارغًا لعرض المتجر المعتاد.",
          },
        ],
      },
      { key: "autoplay", label: "Play by itself", kind: "boolean" },
      { key: "seconds", label: "Seconds per slide", kind: "number", min: 2, max: 30 },
      { key: "startDelay", label: "Wait before the first move (seconds)", kind: "number", min: 0, max: 120 },
      { key: "arrows", label: "Show arrows", kind: "boolean" },
      { key: "dots", label: "Show dots", kind: "boolean" },
      { key: "wave", label: "Wave along the bottom", kind: "boolean" },
      { key: "height", label: "Height on a computer (px)", kind: "number", min: 240, max: 900 },
      { key: "heightTablet", label: "Height on a tablet (px)", kind: "number", min: 240, max: 900 },
    ],
  },
  category_tiles: {
    label: "Category tiles",
    icon: IconGridDense,
    defaultProps: { heading: "", items: [], columns: 3, columnsMobile: 3, tone: "plain" },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      {
        key: "items",
        label: "Categories",
        kind: "itemList",
        itemLabel: "Category",
        itemLabelAr: "قسم",
        titleKey: "title",
        max: 24,
        fields: [
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
          { key: "title", label: "Name", labelAr: "الاسم", kind: "text" },
          { key: "titleEn", label: "Name (English)", labelAr: "الاسم (إنجليزي)", kind: "text" },
          { key: "href", label: "Links to", labelAr: "الرابط", kind: "text", ltr: true },
        ],
      },
      { key: "columns", label: "Columns on a computer", kind: "number", min: 2, max: 6 },
      { key: "columnsMobile", label: "Columns on a phone", kind: "number", min: 2, max: 4 },
      TONE,
    ],
  },
  trust_strip: {
    label: "Trust cards",
    icon: IconShield,
    defaultProps: { items: [], tone: "plain" },
    fields: [
      {
        key: "items",
        label: "Cards",
        kind: "itemList",
        itemLabel: "Card",
        itemLabelAr: "كارت",
        titleKey: "title",
        max: 8,
        fields: [
          { key: "icon", label: "Icon", labelAr: "الأيقونة", kind: "select", options: [{ value: "box", label: "Box", labelAr: "صندوق" }, { value: "cash", label: "Cash", labelAr: "كاش" }, { value: "truck", label: "Truck", labelAr: "شحن" }, { value: "shield", label: "Shield", labelAr: "حماية" }, { value: "support", label: "Support", labelAr: "دعم" }, { value: "return", label: "Return", labelAr: "استرجاع" }, { value: "gift", label: "Gift", labelAr: "هدية" }, { value: "clock", label: "Clock", labelAr: "ساعة" }, { value: "heart", label: "Heart", labelAr: "قلب" }, { value: "star", label: "Star", labelAr: "نجمة" }] },
          { key: "title", label: "Title", labelAr: "العنوان", kind: "text" },
          { key: "titleEn", label: "Title (English)", labelAr: "العنوان (إنجليزي)", kind: "text" },
          { key: "text", label: "Line", labelAr: "السطر", kind: "text" },
          { key: "textEn", label: "Line (English)", labelAr: "السطر (إنجليزي)", kind: "text" },
        ],
      },
      TONE,
    ],
  },
  bundle_cards: {
    label: "Bundle cards",
    icon: IconOrders,
    defaultProps: { heading: "", subheading: "", badge: "", collection: "", limit: 4, mobileOnly: false, tone: "plain" },
    fields: [
      ...productBand(4).filter((f) => !["showDiscount", "buttonLabel", "buttonHref"].includes(f.key)),
      { key: "badge", label: "Badge on discounted products", kind: "text" },
      { key: "mobileOnly", label: "Phones only", kind: "boolean", hint: "Hidden on wider screens." },
    ],
  },
  need_picker: {
    label: "Need picker",
    icon: IconClick,
    defaultProps: { kicker: "", heading: "", sub: "", ctaLabel: "", moreLabel: "", saveLabel: "", stages: [], tone: "cool" },
    fields: [
      { key: "kicker", label: "Small line above", kind: "text" },
      { key: "heading", label: "Heading", kind: "text" },
      { key: "sub", label: "Line under the heading", kind: "text" },
      { key: "ctaLabel", label: "Button text", kind: "text" },
      { key: "moreLabel", label: "\"Also in this set\" wording", kind: "text" },
      { key: "saveLabel", label: "Saving wording", kind: "text", hint: "Write [amount] where the saving goes." },
      {
        key: "stages",
        label: "Needs",
        kind: "itemList",
        itemLabel: "Need",
        itemLabelAr: "احتياج",
        titleKey: "name",
        max: 8,
        fields: [
          { key: "icon", label: "Icon", labelAr: "الأيقونة", kind: "select", options: [{ value: "moon", label: "Moon", labelAr: "هلال" }, { value: "bottle", label: "Bottle", labelAr: "ببرونة" }, { value: "bag", label: "Bag", labelAr: "شنطة" }, { value: "clock", label: "Clock", labelAr: "ساعة" }, { value: "box", label: "Box", labelAr: "صندوق" }, { value: "heart", label: "Heart", labelAr: "قلب" }, { value: "star", label: "Star", labelAr: "نجمة" }, { value: "gift", label: "Gift", labelAr: "هدية" }, { value: "home", label: "Home", labelAr: "بيت" }, { value: "sun", label: "Sun", labelAr: "شمس" }] },
          { key: "name", label: "Name", labelAr: "الاسم", kind: "text" },
          { key: "nameEn", label: "Name (English)", labelAr: "الاسم (إنجليزي)", kind: "text" },
          { key: "pain", label: "Question on the tab", labelAr: "السؤال على التاب", kind: "text" },
          { key: "painEn", label: "Question (English)", labelAr: "السؤال (إنجليزي)", kind: "text" },
          { key: "desc", label: "Description", labelAr: "الوصف", kind: "textarea" },
          { key: "descEn", label: "Description (English)", labelAr: "الوصف (إنجليزي)", kind: "textarea" },
          { key: "items", label: "Points, one per line", labelAr: "النقاط، كل نقطة في سطر", kind: "lines" },
          { key: "itemsEn", label: "Points (English)", labelAr: "النقاط (إنجليزي)", kind: "lines" },
          { key: "productId", label: "Product", labelAr: "المنتج", kind: "product" },
          { key: "altProductId", label: "Second product", labelAr: "منتج ثانٍ", kind: "product" },
          { key: "image", label: "Picture instead of the product's", labelAr: "صورة بدل صورة المنتج", kind: "image" },
        ],
      },
      TONE,
    ],
  },
  product_rail: {
    label: "Sliding products",
    icon: IconRows,
    defaultProps: { heading: "", collection: "", limit: 8, showDiscount: true, imageFit: "contain", autoplay: true, speed: "normal", buttonLabel: "", buttonHref: "/products", tone: "plain" },
    fields: [
      ...productBand(8).filter((f) => f.key !== "subheading"),
      { key: "autoplay", label: "Slide by itself", kind: "boolean" },
      {
        key: "speed",
        label: "Speed",
        kind: "select",
        options: [
          { value: "slow", label: "Slow" },
          { value: "normal", label: "Normal" },
          { value: "fast", label: "Fast" },
        ],
      },
    ],
  },
  video_reels: {
    label: "Video shelf",
    icon: IconVideoBlock,
    defaultProps: { heading: "", subheading: "", items: [], tone: "primary" },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "subheading", label: "Line under the heading", kind: "text" },
      {
        key: "items",
        label: "Videos",
        kind: "itemList",
        itemLabel: "Video",
        itemLabelAr: "فيديو",
        titleKey: "productId",
        max: 12,
        fields: [
          { key: "video", label: "Video address (mp4)", labelAr: "رابط الفيديو (mp4)", kind: "text", ltr: true },
          { key: "poster", label: "Still picture", labelAr: "صورة الغلاف", kind: "image" },
          { key: "productId", label: "Product", labelAr: "المنتج", kind: "product" },
        ],
      },
      TONE,
    ],
  },
  product_shelf: {
    label: "Product shelf",
    icon: IconPanelTop,
    defaultProps: { heading: "", subheading: "", collection: "", limit: 8, showDiscount: true, showSoldOut: true, imageFit: "contain", buttonLabel: "", buttonHref: "/products", tone: "secondary" },
    fields: [...productBand(8), { key: "showSoldOut", label: "Keep sold-out products", kind: "boolean" }],
  },
  product_cards: {
    label: "Product cards",
    icon: IconGridView,
    defaultProps: { heading: "", subheading: "", collection: "", limit: 8, columns: 4, showDiscount: true, buttonLabel: "", buttonHref: "/products", tone: "plain" },
    fields: [...productBand(8), { key: "columns", label: "Columns on a computer", kind: "number", min: 2, max: 6 }],
  },
  image_banner: {
    label: "Picture banner",
    icon: IconFilm,
    defaultProps: { image: "", mobileImage: "", alt: "", heading: "", text: "", buttonLabel: "", buttonHref: "/products", height: 490, heightTablet: 430, heightMobile: 390, wave: true },
    fields: [
      { key: "image", label: "Picture", kind: "image" },
      { key: "mobileImage", label: "Picture on a phone", kind: "image" },
      { key: "alt", label: "Alt text", kind: "text", hint: "Describes the picture to screen readers." },
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "buttonHref", label: "Button links to", kind: "text", placeholder: "/products" },
      { key: "height", label: "Height on a computer (px)", kind: "number", min: 200, max: 900 },
      { key: "heightMobile", label: "Height on a phone (px)", kind: "number", min: 200, max: 900 },
      { key: "wave", label: "Wave along the bottom", kind: "boolean" },
    ],
  },
};

export const SHOWCASE_LABEL_AR: Record<ShowcaseType, string> = {
  hero_slider: "سلايدر صور",
  category_tiles: "مربعات الأقسام",
  trust_strip: "كروت الثقة",
  bundle_cards: "كروت الباقات",
  need_picker: "اختيار حسب الاحتياج",
  product_rail: "منتجات متحركة",
  video_reels: "رف الفيديوهات",
  product_shelf: "رف منتجات",
  product_cards: "كروت المنتجات",
  image_banner: "بانر صورة",
};

const DESCRIPTION: Record<ShowcaseType, string> = {
  hero_slider: "Full-width pictures that fade into each other, each with its own button.",
  category_tiles: "Square pictures of your categories under one heading.",
  trust_strip: "Four reasons to trust you, each in its own card.",
  bundle_cards: "A collection's products as compact cards — made for phones.",
  need_picker: "Tabs a shopper picks a need from, each answered by one product.",
  product_rail: "A collection's products sliding past on their own.",
  video_reels: "Tall clips side by side, each with the product it shows.",
  product_shelf: "A collection in a row with arrows and dots.",
  product_cards: "A collection as a grid of cards with add-to-cart.",
  image_banner: "A wide picture with a heading, a line and a button over it.",
};

const GROUP: Record<ShowcaseType, BlockPreset["group"]> = {
  hero_slider: "hero",
  category_tiles: "commerce",
  trust_strip: "trust",
  bundle_cards: "commerce",
  need_picker: "commerce",
  product_rail: "commerce",
  video_reels: "story",
  product_shelf: "commerce",
  product_cards: "commerce",
  image_banner: "hero",
};

/** One block per band: a full-bleed section holding that single element. */
export const SHOWCASE_PRESETS: BlockPreset[] = SHOWCASE_TYPES.map((type) => ({
  key: `showcase-${type.replace(/_/g, "-")}`,
  label: SHOWCASE_ELEMENT_SPECS[type].label,
  description: DESCRIPTION[type],
  icon: SHOWCASE_ELEMENT_SPECS[type].icon,
  group: GROUP[type],
  elements: [type],
  settings: { width: "full", padding: "tight" },
}));

/** The one-line gist a section card shows for a showcase element; null for any other type. */
export function showcaseSummary(type: string, props: Record<string, unknown>): string | null {
  if (!(SHOWCASE_TYPES as readonly string[]).includes(type)) return null;
  const text = (key: string) => (typeof props[key] === "string" ? (props[key] as string) : "");
  const count = (key: string) => (Array.isArray(props[key]) ? (props[key] as unknown[]).length : 0);
  const parts =
    type === "hero_slider"
      ? [`${count("slides")} slides`]
      : type === "category_tiles" || type === "trust_strip" || type === "video_reels"
        ? [text("heading"), `${count("items")} items`]
        : type === "need_picker"
          ? [text("heading"), `${count("stages")} needs`]
          : [text("heading"), text("collection")];
  return parts.filter(Boolean).join(" · ");
}
