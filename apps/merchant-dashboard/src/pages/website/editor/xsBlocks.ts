import { IconBlog, IconCarousel, IconEmail, IconGridDense, IconGridView, IconHeadingOne, IconImage, IconLayoutSplit, IconPanelTop, IconPeople, IconQuote, IconShield, IconVideoBlock, type IconComponent } from "@/components/icons";
import type { PageElementType } from "@store-builder/api-client";
import { XS_ONLY_ENABLED } from "@/lib/features";
import type { BlockPreset, FieldSpec } from "./blocks";

/**
 * The "xs" sections in the editor — bands drawn in the look of an imported
 * third-party template (xs = external stores; storefront
 * page-renderer/xs): what the inspector offers for each kind of
 * band, and one ready-made block per band of each template.
 *
 * Kept beside blocks.ts rather than in it so that file only gains the spreads
 * that register these. One element type per KIND of band; a preset's `look`
 * names the template it is drawn as, and its starting pictures are that
 * template's own, served by the storefront from `/xs/<look>/`.
 *
 * To take a template out of the library without breaking pages that already
 * use it, add its number to XS_HIDDEN_LOOKS: its blocks leave the side panel
 * and every band already placed keeps drawing. Deleting a template for good
 * is removing its entry from XS_TEMPLATES (and its look on the storefront
 * and the backend) once no page uses it.
 */

export const XS_TYPES = ["xs_slider", "xs_banners", "xs_products", "xs_title", "xs_story", "xs_contact", "xs_hero", "xs_showcase", "xs_features", "xs_split", "xs_minis", "xs_quotes", "xs_gallery", "xs_newsletter", "xs_team", "xs_video", "xs_posts"] as const satisfies readonly PageElementType[];

type XsType = (typeof XS_TYPES)[number];

/**
 * The editor offers only the imported templates: the side library lists only
 * xs bands, and Zimos's own ready styles and store themes are not shown
 * (library/purposes.ts, BlockLibrary.tsx, StoreLookPanel.tsx, WebsitePage.tsx).
 * Pages that already use Zimos's own blocks keep them, and they can still be
 * edited; nothing is deleted. Off (the default, VITE_XS_ONLY_ENABLED) brings
 * everything back.
 */
export const XS_ONLY = XS_ONLY_ENABLED;

/** Looks whose blocks are not offered any more. Bands already on a page are untouched. */
export const XS_HIDDEN_LOOKS: readonly string[] = [];

interface XsSpec {
  label: string;
  icon: IconComponent;
  defaultProps: Record<string, unknown>;
  fields: FieldSpec[];
}

export const XS_ELEMENT_SPECS: Record<XsType, XsSpec> = {
  xs_slider: {
    label: "Picture slider (template look)",
    icon: IconCarousel,
    defaultProps: { look: "01", slides: [], autoplay: true, seconds: 6 },
    fields: [
      {
        key: "slides",
        label: "Slides",
        kind: "itemList",
        itemLabel: "Slide",
        itemLabelAr: "شريحة",
        titleKey: "heading",
        max: 8,
        fields: [
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
          { key: "eyebrow", label: "Small line above the heading", labelAr: "سطر صغير فوق العنوان", kind: "text" },
          { key: "heading", label: "Heading", labelAr: "العنوان", kind: "text" },
          { key: "text", label: "Sentence under the heading", labelAr: "جملة تحت العنوان", kind: "textarea" },
          { key: "buttonLabel", label: "Button text", labelAr: "نص الزر", kind: "text" },
          { key: "buttonHref", label: "Button links to", labelAr: "رابط الزر", kind: "text", ltr: true },
        ],
      },
      { key: "autoplay", label: "Change slides by itself", kind: "boolean" },
      { key: "seconds", label: "Seconds per slide", kind: "number", min: 2, max: 30 },
    ],
  },
  xs_banners: {
    label: "Category banners (template look)",
    icon: IconGridView,
    defaultProps: { look: "01", items: [] },
    fields: [
      { key: "heading", label: "Heading over the pictures", kind: "text" },
      { key: "text", label: "Line under the heading", kind: "textarea" },
      {
        key: "variant",
        label: "Where the words go",
        kind: "select",
        options: [
          { value: "frame", label: "On the picture, in its corner" },
          { value: "card", label: "Under the picture" },
          { value: "tile", label: "One label in the middle" },
          { value: "mosaic", label: "One large picture beside smaller ones" },
        ],
      },
      { key: "wide", label: "Edge to edge, with no gap between the pictures", kind: "boolean" },
      {
        key: "items",
        label: "Banners",
        kind: "itemList",
        itemLabel: "Banner",
        itemLabelAr: "بانر",
        titleKey: "title",
        max: 6,
        fields: [
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
          { key: "title", label: "Title", labelAr: "العنوان", kind: "text" },
          { key: "text", label: "Line under it", labelAr: "السطر تحته", kind: "text" },
          { key: "linkLabel", label: "Link text (shown on hover)", labelAr: "نص الرابط (يظهر عند المرور)", kind: "text" },
          { key: "href", label: "Links to", labelAr: "الرابط", kind: "text", ltr: true },
        ],
      },
    ],
  },
  xs_products: {
    label: "Product grid (template look)",
    icon: IconGridDense,
    defaultProps: { look: "01", heading: "", collection: "", limit: 8, showDiscount: true, showTabs: true, showSearch: true, layout: "grid", quickView: true },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      {
        key: "collection",
        label: "Collection",
        kind: "text",
        placeholder: "best-seller",
        hint: "The collection's address name (slug). Leave empty for the newest products.",
      },
      { key: "limit", label: "How many at a time", kind: "number", min: 1, max: 24, hint: "A Load more button brings the next ones." },
      { key: "showDiscount", label: "Show the discount", kind: "boolean" },
      { key: "showTabs", label: "Show your collections as tabs", kind: "boolean" },
      { key: "showSearch", label: "Show the search button", kind: "boolean" },
      {
        key: "layout",
        label: "Laid out as",
        kind: "select",
        options: [
          { value: "grid", label: "A grid that wraps" },
          { value: "slider", label: "One row to slide along" },
        ],
      },
      { key: "quickView", label: "Open a product in a quick-view panel", kind: "boolean", hint: "Off, the label on a card goes to the product's page." },
      { key: "linkLabel", label: "Link beside the heading", kind: "text", placeholder: "View all products" },
      { key: "linkHref", label: "The link goes to", kind: "text", placeholder: "/products" },
      { key: "allLabel", label: "Wording: the first tab", kind: "text", placeholder: "All Products" },
      { key: "searchLabel", label: "Wording: the search button", kind: "text", placeholder: "Search" },
      { key: "searchPlaceholder", label: "Wording: hint in the search box", kind: "text", placeholder: "Search" },
      { key: "loadMoreLabel", label: "Wording: the load-more button", kind: "text", placeholder: "Load More" },
      { key: "viewLabel", label: "Wording: the label on a card", kind: "text", placeholder: "Quick View" },
      { key: "openLabel", label: "Wording: the button in the quick-view panel", kind: "text", placeholder: "View product" },
      { key: "emptyText", label: "Wording: when nothing is found", kind: "text" },
    ],
  },
  xs_title: {
    label: "Page title banner (template look)",
    icon: IconHeadingOne,
    defaultProps: { look: "01", heading: "", image: "" },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "image", label: "Picture behind it", kind: "image" },
    ],
  },
  xs_story: {
    label: "Story with pictures (template look)",
    icon: IconLayoutSplit,
    defaultProps: { look: "01", items: [] },
    fields: [
      {
        key: "items",
        label: "Parts",
        kind: "itemList",
        itemLabel: "Part",
        itemLabelAr: "جزء",
        titleKey: "title",
        max: 6,
        fields: [
          { key: "title", label: "Title", labelAr: "العنوان", kind: "text" },
          { key: "body", label: "Text (a blank line starts a new paragraph)", labelAr: "النص (سطر فارغ يبدأ فقرة جديدة)", kind: "textarea" },
          { key: "quote", label: "Quote under the text", labelAr: "اقتباس تحت النص", kind: "textarea" },
          { key: "quoteAuthor", label: "Who said it", labelAr: "صاحب الاقتباس", kind: "text" },
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
        ],
      },
    ],
  },
  xs_contact: {
    label: "Contact form and details (template look)",
    icon: IconEmail,
    defaultProps: { look: "01", heading: "", info: [] },
    fields: [
      { key: "heading", label: "Heading over the form", kind: "text" },
      { key: "contactPlaceholder", label: "Hint in the email or phone box", kind: "text" },
      { key: "messagePlaceholder", label: "Hint in the message box", kind: "text" },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "successMessage", label: "Shown after the message is sent", kind: "text" },
      {
        key: "info",
        label: "Contact details",
        kind: "itemList",
        itemLabel: "Detail",
        itemLabelAr: "بيان",
        titleKey: "title",
        max: 4,
        fields: [
          {
            key: "icon",
            label: "Icon",
            labelAr: "الأيقونة",
            kind: "select",
            options: [
              { value: "address", label: "Address", labelAr: "عنوان" },
              { value: "phone", label: "Phone", labelAr: "هاتف" },
              { value: "email", label: "Email", labelAr: "بريد" },
            ],
          },
          { key: "title", label: "Title", labelAr: "العنوان", kind: "text" },
          { key: "text", label: "Text", labelAr: "النص", kind: "text" },
        ],
      },
    ],
  },
  xs_hero: {
    label: "Hero with a cut-out picture (template look)",
    icon: IconPanelTop,
    defaultProps: { look: "02", heading: "", text: "", image: "" },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Line under it", kind: "textarea" },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "buttonHref", label: "Button links to", kind: "text", placeholder: "/products" },
      { key: "button2Label", label: "Second button text", kind: "text" },
      { key: "button2Href", label: "Second button links to", kind: "text", placeholder: "/about" },
      { key: "image", label: "Picture (a cut-out on a clear background works best)", kind: "image" },
    ],
  },
  xs_showcase: {
    label: "Products with an intro (template look)",
    icon: IconGridView,
    defaultProps: { look: "02", heading: "", text: "", collection: "", limit: 3 },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Line under it", kind: "textarea" },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "buttonHref", label: "Button links to", kind: "text", placeholder: "/products" },
      { key: "collection", label: "Collection", kind: "text", placeholder: "best-seller", hint: "The collection's address name (slug). Leave empty for the newest products." },
      { key: "limit", label: "How many", kind: "number", min: 1, max: 12 },
    ],
  },
  xs_features: {
    label: "Reasons with icons (template look)",
    icon: IconShield,
    defaultProps: { look: "02", heading: "", text: "", image: "", items: [] },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Line under it", kind: "textarea" },
      { key: "image", label: "Picture", kind: "image" },
      {
        key: "items",
        label: "Reasons",
        kind: "itemList",
        itemLabel: "Reason",
        itemLabelAr: "سبب",
        titleKey: "title",
        max: 8,
        fields: [
          {
            key: "icon",
            label: "Icon",
            labelAr: "الأيقونة",
            kind: "select",
            options: [
              { value: "truck", label: "Delivery", labelAr: "توصيل" },
              { value: "bag", label: "Shopping bag", labelAr: "حقيبة تسوق" },
              { value: "support", label: "Support", labelAr: "دعم" },
              { value: "return", label: "Returns", labelAr: "استرجاع" },
            ],
          },
          { key: "image", label: "Your own icon (instead of the one above)", labelAr: "أيقونة خاصة بك (بدلا من الأيقونة السابقة)", kind: "image" },
          { key: "title", label: "Title", labelAr: "العنوان", kind: "text" },
          { key: "text", label: "Text", labelAr: "النص", kind: "textarea" },
        ],
      },
    ],
  },
  xs_split: {
    label: "Three pictures and a list (template look)",
    icon: IconLayoutSplit,
    defaultProps: { look: "02", heading: "", text: "", images: [], points: [] },
    fields: [
      { key: "images", label: "Pictures (three)", kind: "imageList" },
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      { key: "points", label: "Points", kind: "stringList", itemLabel: "Point" },
      { key: "endsAt", label: "The offer ends", kind: "datetime", hint: "A countdown shows until then. Leave empty for none." },
      { key: "countdownLabels", label: "Wording under the countdown (days, hours, minutes, seconds)", kind: "stringList", itemLabel: "Word" },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "buttonHref", label: "Button links to", kind: "text", placeholder: "/products" },
    ],
  },
  xs_minis: {
    label: "Small product cards (template look)",
    icon: IconGridDense,
    defaultProps: { look: "02", collection: "", limit: 3 },
    fields: [
      { key: "collection", label: "Collection", kind: "text", placeholder: "best-seller", hint: "The collection's address name (slug). Leave empty for the newest products." },
      { key: "limit", label: "How many", kind: "number", min: 1, max: 9 },
      { key: "linkLabel", label: "Link text", kind: "text" },
    ],
  },
  xs_quotes: {
    label: "Customer quotes (template look)",
    icon: IconQuote,
    defaultProps: { look: "02", heading: "", items: [] },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      {
        key: "items",
        label: "Quotes",
        kind: "itemList",
        itemLabel: "Quote",
        itemLabelAr: "رأي",
        titleKey: "name",
        max: 8,
        fields: [
          { key: "quote", label: "What they said", labelAr: "ما قاله", kind: "textarea" },
          { key: "name", label: "Name", labelAr: "الاسم", kind: "text" },
          { key: "role", label: "Line under the name", labelAr: "السطر تحت الاسم", kind: "text" },
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
        ],
      },
    ],
  },
  xs_gallery: {
    label: "Picture row (template look)",
    icon: IconImage,
    defaultProps: { look: "01", heading: "", images: [] },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Line under it", kind: "textarea" },
      { key: "images", label: "Pictures (up to twelve)", kind: "imageList" },
      {
        key: "variant",
        label: "The pictures are",
        kind: "select",
        options: [
          { value: "photos", label: "Photographs, cropped square" },
          { value: "logos", label: "Logos, shown whole" },
        ],
      },
      { key: "href", label: "Every picture links to", kind: "text", placeholder: "https://instagram.com/yourstore" },
    ],
  },
  xs_newsletter: {
    label: "Newsletter sign-up (template look)",
    icon: IconEmail,
    defaultProps: { look: "01", heading: "", text: "" },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Line under it", kind: "textarea" },
      { key: "placeholder", label: "Hint in the email box", kind: "text" },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "successMessage", label: "Shown after signing up", kind: "text" },
      { key: "image", label: "Picture behind it", kind: "image" },
    ],
  },
  xs_team: {
    label: "Team (template look)",
    icon: IconPeople,
    defaultProps: { look: "01", heading: "", items: [] },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Line under it", kind: "textarea" },
      {
        key: "items",
        label: "People",
        kind: "itemList",
        itemLabel: "Person",
        itemLabelAr: "شخص",
        titleKey: "name",
        max: 8,
        fields: [
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
          { key: "name", label: "Name", labelAr: "الاسم", kind: "text" },
          { key: "role", label: "Role", labelAr: "الوظيفة", kind: "text" },
          { key: "text", label: "A line about them", labelAr: "سطر عنه", kind: "textarea" },
        ],
      },
    ],
  },
  xs_video: {
    label: "Video (template look)",
    icon: IconVideoBlock,
    defaultProps: { look: "01", heading: "", url: "" },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Line under it", kind: "textarea" },
      { key: "url", label: "Video address", kind: "text", placeholder: "https://www.youtube.com/watch?v=…", hint: "A YouTube or Vimeo link, or the address of a video file." },
    ],
  },
  xs_posts: {
    label: "Article cards (template look)",
    icon: IconBlog,
    defaultProps: { look: "01", heading: "", items: [] },
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Line under it", kind: "textarea" },
      { key: "linkLabel", label: "Link beside the heading", kind: "text", placeholder: "View all" },
      { key: "linkHref", label: "The link goes to", kind: "text", placeholder: "/blog" },
      {
        key: "items",
        label: "Articles",
        kind: "itemList",
        itemLabel: "Article",
        itemLabelAr: "مقال",
        titleKey: "title",
        max: 6,
        fields: [
          { key: "image", label: "Picture", labelAr: "الصورة", kind: "image" },
          { key: "meta", label: "Small line (date, writer)", labelAr: "سطر صغير (التاريخ، الكاتب)", kind: "text" },
          { key: "title", label: "Title", labelAr: "العنوان", kind: "text" },
          { key: "text", label: "Sentence", labelAr: "جملة", kind: "textarea" },
          { key: "linkLabel", label: "Link text", labelAr: "نص الرابط", kind: "text" },
          { key: "href", label: "Links to", labelAr: "الرابط", kind: "text", ltr: true },
        ],
      },
    ],
  },
};

/** Which bands a choice about look makes sense on. */
const GRID_TYPES: readonly XsType[] = ["xs_banners", "xs_products", "xs_features", "xs_team", "xs_gallery", "xs_minis", "xs_posts"];
const SIDED_TYPES: readonly XsType[] = ["xs_hero", "xs_split"];
const HEIGHT_TYPES: readonly XsType[] = ["xs_slider", "xs_title", "xs_hero", "xs_newsletter"];
const PICTURE_TYPES: readonly XsType[] = ["xs_banners", "xs_products", "xs_showcase", "xs_features", "xs_split", "xs_minis", "xs_gallery", "xs_posts", "xs_story", "xs_team"];
const LONE_PICTURE_TYPES: readonly XsType[] = ["xs_hero", "xs_split", "xs_features", "xs_story"];
const BUTTON_TYPES: readonly XsType[] = ["xs_slider", "xs_banners", "xs_products", "xs_hero", "xs_showcase", "xs_split", "xs_minis", "xs_contact", "xs_newsletter", "xs_posts"];
const ITEM_TITLE_TYPES: readonly XsType[] = ["xs_banners", "xs_products", "xs_story", "xs_contact", "xs_showcase", "xs_features", "xs_minis", "xs_quotes", "xs_team", "xs_posts"];

const KEEPS = "Empty keeps the template's own.";

/**
 * A band's own look, offered on every xs band after its content (storefront
 * xs/own.tsx reads the same names and ranges):
 * anything left empty keeps the template's. Sizes are in pixels on a wide
 * screen; a phone gets them scaled down. Each may be set apart for a tablet
 * and a phone (perScreen): the inspector edits the previewed screen's.
 */
for (const type of XS_TYPES) {
  const fields = XS_ELEMENT_SPECS[type].fields;
  const ownFrom = fields.length;
  // Layout
  if (GRID_TYPES.includes(type)) fields.push({ key: "columns", label: "Columns on a wide screen", kind: "number", min: 1, max: 6, hint: "Empty keeps the template's own. Phones and tablets always use fewer." });
  if (HEIGHT_TYPES.includes(type)) fields.push({ key: "height", label: "Height of the section (pixels)", kind: "number", min: 120, max: 1200, hint: KEEPS });
  if (SIDED_TYPES.includes(type)) fields.push({ key: "flip", label: "Swap the picture and the words", kind: "boolean" });
  fields.push(
    { key: "width", label: "Width of the content (pixels)", kind: "number", min: 480, max: 2400, hint: "How far the content runs from side to side on a wide screen." },
    { key: "paddingTop", label: "Space above (pixels)", kind: "number", min: 0, max: 400, hint: KEEPS },
    { key: "paddingBottom", label: "Space below (pixels)", kind: "number", min: 0, max: 400, hint: KEEPS }
  );
  if (GRID_TYPES.includes(type)) fields.push({ key: "gap", label: "Gap between items (pixels)", kind: "number", min: 0, max: 160, hint: KEEPS });
  fields.push({
    key: "align",
    label: "Words line up",
    kind: "select",
    options: [
      { value: "start", label: "At the start" },
      { value: "center", label: "In the middle" },
      { value: "end", label: "At the end" },
    ],
  });
  // Type
  fields.push(
    { key: "headingSize", label: "Size of the heading (pixels)", kind: "number", min: 12, max: 160, hint: "The large heading of the section. " + KEEPS },
    {
      key: "headingWeight",
      label: "Weight of the heading",
      kind: "select",
      options: [
        { value: "light", label: "Light" },
        { value: "regular", label: "Regular" },
        { value: "medium", label: "Medium" },
        { value: "semibold", label: "Semi-bold" },
        { value: "bold", label: "Bold" },
        { value: "black", label: "Black" },
      ],
    }
  );
  if (ITEM_TITLE_TYPES.includes(type)) fields.push({ key: "titleSize", label: "Size of the items' titles (pixels)", kind: "number", min: 10, max: 80, hint: "The title of each card or item in the section." });
  fields.push({ key: "textSize", label: "Size of the text (pixels)", kind: "number", min: 10, max: 40, hint: "Sentences and small lines." });
  // Pictures
  if (PICTURE_TYPES.includes(type)) {
    fields.push(
      {
        key: "imageRatio",
        label: "Shape of the pictures",
        kind: "select",
        options: [
          { value: "1:1", label: "Square (1:1)" },
          { value: "4:3", label: "Landscape (4:3)" },
          { value: "3:2", label: "Landscape (3:2)" },
          { value: "16:9", label: "Wide (16:9)" },
          { value: "21:9", label: "Strip (21:9)" },
          { value: "3:4", label: "Portrait (3:4)" },
          { value: "4:5", label: "Portrait (4:5)" },
          { value: "2:3", label: "Tall (2:3)" },
        ],
        hint: "Every picture in the section takes this shape.",
      },
      { key: "imageHeight", label: "Height of the pictures (pixels)", kind: "number", min: 40, max: 1400, hint: "An exact height instead of a shape. Leave the shape empty to use it." },
      {
        key: "imageFit",
        label: "A picture in its box",
        kind: "select",
        options: [
          { value: "cover", label: "Fills it (edges may be cut)" },
          { value: "contain", label: "Shows whole (may leave room)" },
        ],
      },
      { key: "imageRadius", label: "Rounded corners of the pictures (pixels)", kind: "number", min: 0, max: 400 }
    );
  }
  if (LONE_PICTURE_TYPES.includes(type)) fields.push({ key: "imageWidth", label: "Width of the picture (pixels)", kind: "number", min: 60, max: 1800, hint: "The picture that stands beside the words." });
  // Buttons
  if (BUTTON_TYPES.includes(type)) {
    fields.push(
      { key: "buttonSize", label: "Size of the words on buttons (pixels)", kind: "number", min: 10, max: 32 },
      { key: "buttonRadius", label: "Rounded corners of buttons (pixels)", kind: "number", min: 0, max: 100, hint: "0 is square; 30 or more is a pill." }
    );
  }
  // Colours
  fields.push(
    { key: "headingColor", label: "Colour: headings", kind: "color", hint: KEEPS },
    { key: "textColor", label: "Colour: text", kind: "color" },
    { key: "accentColor", label: "Colour: buttons, links and badges", kind: "color" },
    { key: "backgroundColor", label: "Colour: background", kind: "color", hint: "A flat colour, in place of the template's colour or photograph." }
  );
  for (const field of fields.slice(ownFrom)) field.perScreen = true;
}

/**
 * The inspector's groups for an xs band, in the order it shows them: every
 * field of a band belongs to one, so a merchant looking for "the size of the
 * pictures" opens Pictures instead of reading a long list. `hint` says what
 * the group changes on the page.
 */
export type XsFieldGroup = "content" | "layout" | "type" | "pictures" | "buttons" | "colours" | "wording";
export const XS_FIELD_GROUPS: ReadonlyArray<{ id: XsFieldGroup; title: string; titleAr: string; hint: string; hintAr: string }> = [
  { id: "content", title: "Content", titleAr: "المحتوى", hint: "The words, pictures and links inside this section.", hintAr: "النصوص والصور والروابط داخل هذا القسم." },
  { id: "layout", title: "Layout and spacing", titleAr: "التخطيط والمسافات", hint: "Columns, height, width and the space around the section.", hintAr: "عدد الأعمدة والارتفاع والعرض والمسافة حول القسم." },
  { id: "type", title: "Text sizes", titleAr: "أحجام الخطوط", hint: "How large the heading, the titles and the text are.", hintAr: "حجم العنوان الكبير وعناوين العناصر والنص." },
  { id: "pictures", title: "Pictures", titleAr: "الصور", hint: "The shape, size and corners of the pictures.", hintAr: "شكل الصور ومقاسها واستدارة حوافها." },
  { id: "buttons", title: "Buttons", titleAr: "الأزرار", hint: "The size and corners of the buttons.", hintAr: "حجم نص الأزرار واستدارة حوافها." },
  { id: "colours", title: "Colours", titleAr: "الألوان", hint: "Colours of this section only. Empty keeps the template's.", hintAr: "ألوان هذا القسم فقط. الحقل الفارغ يبقي لون القالب." },
  { id: "wording", title: "Small wording", titleAr: "الكلمات الثابتة الصغيرة", hint: "Labels the section writes by itself: tabs, buttons, messages.", hintAr: "الكلمات التي يكتبها القسم تلقائيا: التبويبات والأزرار والرسائل." },
];
const GROUP_OF_KEY: Record<string, XsFieldGroup> = {
  columns: "layout", height: "layout", flip: "layout", width: "layout", paddingTop: "layout", paddingBottom: "layout", gap: "layout", align: "layout",
  wide: "layout", layout: "layout", variant: "layout",
  headingSize: "type", headingWeight: "type", titleSize: "type", textSize: "type",
  imageRatio: "pictures", imageHeight: "pictures", imageFit: "pictures", imageRadius: "pictures", imageWidth: "pictures",
  buttonSize: "buttons", buttonRadius: "buttons",
  headingColor: "colours", textColor: "colours", accentColor: "colours", backgroundColor: "colours",
  allLabel: "wording", searchLabel: "wording", searchPlaceholder: "wording", loadMoreLabel: "wording", viewLabel: "wording", openLabel: "wording", emptyText: "wording",
  successMessage: "wording", countdownLabels: "wording", contactPlaceholder: "wording", messagePlaceholder: "wording", placeholder: "wording",
};
export function xsFieldGroup(key: string): XsFieldGroup {
  return GROUP_OF_KEY[key] ?? "content";
}
export function isXsType(type: string): type is XsType {
  return (XS_TYPES as readonly string[]).includes(type);
}

/** Arabic for the fields above, merged into the editor's field labels (editorLocale.ts). */
export const XS_FIELD_AR: Record<string, string> = {
  wide: "بعرض الصفحة كلها ودون مسافات بين الصور",
  columns: "عدد الأعمدة على الشاشة العريضة",
  height: "ارتفاع القسم (بالبكسل)",
  flip: "تبديل مكان الصورة والنص",
  width: "عرض المحتوى (بالبكسل)",
  paddingTop: "المسافة فوق القسم (بالبكسل)",
  paddingBottom: "المسافة تحت القسم (بالبكسل)",
  gap: "المسافة بين العناصر (بالبكسل)",
  align: "محاذاة النص",
  headingSize: "حجم العنوان الكبير (بالبكسل)",
  headingWeight: "سُمك العنوان",
  titleSize: "حجم عناوين العناصر (بالبكسل)",
  textSize: "حجم النص (بالبكسل)",
  imageRatio: "شكل الصور",
  imageHeight: "ارتفاع الصور (بالبكسل)",
  imageFit: "طريقة عرض الصورة في مكانها",
  imageRadius: "استدارة حواف الصور (بالبكسل)",
  imageWidth: "عرض الصورة (بالبكسل)",
  buttonSize: "حجم نص الأزرار (بالبكسل)",
  buttonRadius: "استدارة حواف الأزرار (بالبكسل)",
  headingColor: "لون العناوين",
  textColor: "لون النص",
  accentColor: "لون الأزرار والروابط والشارات",
  backgroundColor: "لون الخلفية",
};

/**
 * Arabic for the bands' content fields. A plain key is the same on every xs
 * band that has the field; `type.key` is one band's own wording for it. They
 * are filed under the band's type in the editor's labels (editorLocale.ts),
 * so none of them renames a field of another kind of element.
 */
export const XS_CONTENT_AR: Record<string, string> = {
  slides: "الشرائح",
  autoplay: "تغيير الشرائح تلقائيا",
  seconds: "عدد الثواني لكل شريحة",
  heading: "العنوان",
  "xs_banners.heading": "العنوان فوق الصور",
  "xs_contact.heading": "العنوان فوق النموذج",
  "xs_banners.items": "البانرات",
  "xs_story.items": "الأجزاء",
  "xs_features.items": "المميزات",
  "xs_quotes.items": "آراء العملاء",
  "xs_team.items": "أعضاء الفريق",
  "xs_posts.items": "المقالات",
  collection: "القسم الذي تظهر منتجاته",
  showDiscount: "إظهار الخصم",
  showTabs: "إظهار أقسامك كتبويبات",
  showSearch: "إظهار زر البحث",
  layout: "طريقة العرض",
  quickView: "فتح المنتج في نافذة «نظرة سريعة»",
  linkLabel: "نص الرابط بجانب العنوان",
  "xs_minis.linkLabel": "نص الرابط",
  linkHref: "الرابط يذهب إلى",
  allLabel: "كلمة أول تبويب",
  searchLabel: "نص زر البحث",
  searchPlaceholder: "النص المساعد داخل خانة البحث",
  loadMoreLabel: "نص زر «تحميل المزيد»",
  viewLabel: "النص على بطاقة المنتج",
  openLabel: "نص الزر في نافذة «نظرة سريعة»",
  emptyText: "الجملة التي تظهر عند عدم وجود نتائج",
  image: "الصورة",
  "xs_title.image": "الصورة خلف العنوان",
  "xs_newsletter.image": "الصورة خلف النص",
  "xs_hero.image": "الصورة (الأفضل صورة مفرغة بخلفية شفافة)",
  contactPlaceholder: "النص المساعد داخل خانة البريد أو الهاتف",
  messagePlaceholder: "النص المساعد داخل خانة الرسالة",
  placeholder: "النص المساعد داخل خانة البريد",
  buttonLabel: "نص الزر",
  buttonHref: "الزر يذهب إلى",
  button2Label: "نص الزر الثاني",
  button2Href: "الزر الثاني يذهب إلى",
  info: "بيانات التواصل",
  points: "النقاط",
  countdownLabels: "النص تحت العداد (أيام، ساعات، دقائق، ثوان)",
  url: "رابط الفيديو",
};

/** Arabic for those fields' hints, by key: the same on every band that has the field. */
export const XS_HINT_AR: Record<string, string> = {
  columns: "الحقل الفارغ يبقي شكل القالب. الهاتف والجهاز اللوحي يعرضان أعمدة أقل دائما.",
  height: "الحقل الفارغ يبقي ارتفاع القالب.",
  width: "أقصى عرض للمحتوى على الشاشة العريضة.",
  paddingTop: "الحقل الفارغ يبقي مسافة القالب.",
  paddingBottom: "الحقل الفارغ يبقي مسافة القالب.",
  gap: "الحقل الفارغ يبقي مسافة القالب.",
  headingSize: "العنوان الكبير للقسم. الحقل الفارغ يبقي حجم القالب، ويصغر تلقائيا على الهاتف.",
  titleSize: "عنوان كل بطاقة أو عنصر داخل القسم.",
  textSize: "الجُمل والسطور الصغيرة.",
  imageRatio: "كل صور القسم تأخذ هذا الشكل.",
  imageHeight: "ارتفاع محدد بدلا من الشكل. اترك «شكل الصور» فارغا ليعمل.",
  imageWidth: "الصورة الموجودة بجانب النص.",
  buttonRadius: "صفر يعني حواف مربعة، و٣٠ أو أكثر يعني زرا على شكل كبسولة.",
  headingColor: "الحقل الفارغ يبقي لون القالب.",
  backgroundColor: "لون واحد بدلا من لون القالب أو صورته.",
  collection: "اسم القسم كما يظهر في الرابط (slug). اتركه فارغا لعرض أحدث المنتجات.",
  limit: "زر «تحميل المزيد» يعرض المنتجات التالية.",
  quickView: "عند إيقافه، يفتح النص الموجود على البطاقة صفحة المنتج.",
  endsAt: "يظهر العداد حتى هذا الموعد. اتركه فارغا إذا لم ترد عدادا.",
  url: "رابط يوتيوب أو فيميو، أو رابط ملف فيديو.",
};

/** Arabic for those fields' choices (`key.value`), merged into the editor's option labels. */
export const XS_OPTION_AR: Record<string, string> = {
  "align.start": "من البداية",
  "align.center": "في المنتصف",
  "align.end": "من النهاية",
  "headingWeight.light": "خفيف",
  "headingWeight.regular": "عادي",
  "headingWeight.medium": "متوسط",
  "headingWeight.semibold": "شبه عريض",
  "headingWeight.bold": "عريض",
  "headingWeight.black": "عريض جدا",
  "imageRatio.1:1": "مربع (1:1)",
  "imageRatio.4:3": "عرضي (4:3)",
  "imageRatio.3:2": "عرضي (3:2)",
  "imageRatio.16:9": "عريض (16:9)",
  "imageRatio.21:9": "شريط (21:9)",
  "imageRatio.3:4": "طولي (3:4)",
  "imageRatio.4:5": "طولي (4:5)",
  "imageRatio.2:3": "طويل (2:3)",
  "imageFit.cover": "تملأ المكان (قد تقص الأطراف)",
  "imageFit.contain": "تظهر كاملة (قد يبقى فراغ)",
  "variant.frame": "على الصورة، في الركن",
  "variant.card": "تحت الصورة",
  "variant.tile": "كلمة واحدة في المنتصف",
  "variant.mosaic": "صورة كبيرة بجانب صور أصغر",
  "variant.photos": "صور مقصوصة مربعة",
  "variant.logos": "شعارات تظهر كاملة",
  "layout.grid": "شبكة على عدة صفوف",
  "layout.slider": "صف واحد يمرر جانبيا",
};

export const XS_LABEL_AR: Record<XsType, string> = {
  xs_slider: "سلايدر صور (شكل قالب)",
  xs_banners: "بانرات أقسام (شكل قالب)",
  xs_products: "شبكة منتجات (شكل قالب)",
  xs_title: "بانر عنوان الصفحة (شكل قالب)",
  xs_story: "قصة بالصور (شكل قالب)",
  xs_contact: "نموذج وبيانات التواصل (شكل قالب)",
  xs_hero: "واجهة بصورة مقصوصة (شكل قالب)",
  xs_showcase: "منتجات مع مقدمة (شكل قالب)",
  xs_features: "أسباب بأيقونات (شكل قالب)",
  xs_split: "ثلاث صور وقائمة (شكل قالب)",
  xs_minis: "كروت منتجات صغيرة (شكل قالب)",
  xs_quotes: "آراء العملاء (شكل قالب)",
  xs_gallery: "صف صور (شكل قالب)",
  xs_newsletter: "اشتراك النشرة البريدية (شكل قالب)",
  xs_team: "فريق العمل (شكل قالب)",
  xs_video: "فيديو (شكل قالب)",
  xs_posts: "بطاقات مقالات (شكل قالب)",
};

/** Where in the library each kind of band is offered — beside Zimos's own blocks of that kind. */
const GROUP: Record<XsType, BlockPreset["group"]> = {
  xs_slider: "hero",
  xs_banners: "commerce",
  xs_products: "commerce",
  xs_title: "hero",
  xs_story: "story",
  xs_contact: "convert",
  xs_hero: "hero",
  xs_showcase: "commerce",
  xs_features: "trust",
  xs_split: "story",
  xs_minis: "commerce",
  xs_quotes: "trust",
  xs_gallery: "story",
  xs_newsletter: "convert",
  xs_team: "story",
  xs_video: "story",
  xs_posts: "story",
};

interface XsBand {
  type: XsType;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  /** The band's starting props: the template's own pictures and wording. */
  content: Record<string, unknown>;
  /** The page of the template it stands on; absent, its home page. */
  page?: { path: string; title: string };
  /** False for a band that repeats one already offered (a second page's title banner): on its page, not in the library. */
  library?: boolean;
  /** False for a band offered in the library that stands on no page of the look's first template (it is on another of its home pages). */
  onPage?: boolean;
}

/** One imported template: its number (the `look`) and the bands cut out of it. */
interface XsTemplate {
  look: string;
  bands: XsBand[];
}

const art = (look: string, file: string) => `/xs/${look}/${file}`;

const XS_TEMPLATES: XsTemplate[] = [
  {
    look: "01",
    bands: [
      {
        type: "xs_slider",
        label: "Slider 01",
        labelAr: "سلايدر ٠١",
        description: "Full-height pictures with a small line, a large serif heading and a rounded button that drop in one after the other.",
        descriptionAr: "صور بارتفاع الشاشة فوقها سطر صغير وعنوان كبير وزر دائري، يظهرون واحدًا بعد الآخر.",
        content: {
          slides: [
            { image: art("01", "slide-01.jpg"), eyebrow: "Women Collection 2018", heading: "NEW SEASON", buttonLabel: "Shop Now", buttonHref: "/products" },
            { image: art("01", "slide-02.jpg"), eyebrow: "Men New-Season", heading: "Jackets & Coats", buttonLabel: "Shop Now", buttonHref: "/products" },
            { image: art("01", "slide-03.jpg"), eyebrow: "Men Collection 2018", heading: "New arrivals", buttonLabel: "Shop Now", buttonHref: "/products" },
          ],
        },
      },
      {
        type: "xs_banners",
        label: "Banners 01",
        labelAr: "بانرات ٠١",
        description: "Three framed pictures with a title in the corner; a colour veil and a link slide in on hover.",
        descriptionAr: "ثلاث صور بإطار وعنوان في الركن، وعند المرور تظهر طبقة لون ورابط.",
        content: {
          items: [
            { image: art("01", "banner-01.jpg"), title: "Women", text: "Spring 2018", linkLabel: "Shop Now", href: "/products" },
            { image: art("01", "banner-02.jpg"), title: "Men", text: "Spring 2018", linkLabel: "Shop Now", href: "/products" },
            { image: art("01", "banner-03.jpg"), title: "Accessories", text: "New Trend", linkLabel: "Shop Now", href: "/products" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 01",
        labelAr: "شبكة منتجات ٠١",
        description: "Your own products in four columns under tabs of your collections, with a search and a Load more button; tall pictures zoom on hover.",
        descriptionAr: "منتجاتك في أربعة أعمدة تحت تبويبات أقسامك، مع بحث وزر تحميل المزيد، والصور تكبر عند المرور.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", heading: "Product Overview", limit: 8 },
      },
      {
        type: "xs_newsletter",
        label: "Newsletter 01",
        labelAr: "نشرة بريدية 01",
        description: "A heading, a line and a one-line email sign-up. Addresses arrive in your Contacts, marked as agreeing to hear from you.",
        descriptionAr: "عنوان وسطر وخانة اشتراك بالبريد. العناوين تصل إلى جهات الاتصال مع موافقة أصحابها على مراسلتك.",
        content: { heading: "Newsletter", text: "Get the latest collections and offers in your inbox.", placeholder: "Your email address", buttonLabel: "Subscribe" },
      },
      {
        type: "xs_posts",
        label: "Articles 01",
        labelAr: "مقالات 01",
        description: "Three article cards under a centred heading: a picture, who wrote it and when, a title and a sentence. You write each card.",
        descriptionAr: "ثلاث بطاقات مقالات تحت عنوان في المنتصف: صورة وكاتبها وتاريخها وعنوان وجملة. تكتب كل بطاقة بنفسك.",
        // On the look's second home page (XS_ALT_HOMES), not its first: the library still offers it.
        onPage: false,
        content: {
          heading: "Our Blogs",
          items: [
            { image: art("01", "post-1.jpg"), meta: "By Nancy Ward on July 22, 2017", title: "8 Inspiring Ways to Wear Dresses in the Winter", text: "From a wool dress with tall boots to warm cardigan layers: simple ideas that keep your favourite dress with you all winter.", linkLabel: "", href: "" },
            { image: art("01", "post-2.jpg"), meta: "By Nancy Ward on July 18, 2017", title: "The Great Big List of Men’s Gifts for the Holidays", text: "Elegant watches, leather wallets and classic belts: a hand-picked list to help you find the right gift for every occasion.", linkLabel: "", href: "" },
            { image: art("01", "post-3.jpg"), meta: "By Nancy Ward on July 2, 2017", title: "5 Winter-to-Spring Fashion Trends to Try Now", text: "Soft colours, light layers and white sneakers: easy trends that take your wardrobe from winter to spring with little effort.", linkLabel: "", href: "" },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 01",
        labelAr: "عنوان صفحة ٠١",
        description: "The page's name in large white letters over a wide picture.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة فوق صورة عريضة.",
        content: { heading: "About", image: art("01", "bg-01.jpg") },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_story",
        label: "Story 01",
        labelAr: "قصة ٠١",
        description: "Text beside a picture on an offset grey frame; the sides swap from one part to the next, and a part can end on a quote.",
        descriptionAr: "نص بجانب صورة على إطار رمادي مزاح، يتبادلان الجهة من جزء لآخر، ويمكن أن ينتهي الجزء باقتباس.",
        content: {
          items: [
            {
              title: "Our Story",
              body: "Our story began with a simple idea: style should be within everyone's reach. From day one we have chosen every piece with care, from the fabric to the cut, to give you a modern look that lasts more than one season.\n\nToday we bring you the latest fashion for women and men, from everyday basics to shoes, watches and accessories, with fast delivery across Egypt.\n\nAny questions? Visit us at our store in New Cairo, or call us any day from 10 am to 10 pm.",
              image: art("01", "about-01.jpg"),
            },
            {
              title: "Our Mission",
              body: "To bring you modern fashion with quality you can trust and fair prices, and easy shopping from the first click until your order reaches your door.",
              quote: "Creativity is just connecting things. When you ask creative people how they did something, they feel a little guilty because they didn't really do it, they just saw something. It seemed obvious to them after a while.",
              quoteAuthor: "Steve Job’s",
              image: art("01", "about-02.jpg"),
            },
          ],
        },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_title",
        label: "Page title 01",
        labelAr: "عنوان صفحة ٠١",
        description: "",
        descriptionAr: "",
        content: { heading: "Contact", image: art("01", "bg-01.jpg") },
        page: { path: "/contact", title: "Contact" },
        library: false,
      },
      {
        type: "xs_contact",
        label: "Contact 01",
        labelAr: "تواصل ٠١",
        description: "A message form in one box and your address, phone and email in the box beside it. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة في مربع، وعنوانك وهاتفك وبريدك في المربع المجاور. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Send Us A Message",
          contactPlaceholder: "Your Email Address",
          messagePlaceholder: "How Can We Help?",
          buttonLabel: "Submit",
          info: [
            { icon: "address", title: "Address", text: "Coza Store, Fifth Settlement, New Cairo" },
            { icon: "phone", title: "Lets Talk", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Sale Support", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "02",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 02",
        labelAr: "واجهة ٠٢",
        description: "A large heading, a line and two rounded buttons on deep green, with a cut-out picture standing out of the band over a field of dots.",
        descriptionAr: "عنوان كبير وسطر وزران دائريان على أخضر غامق، وصورة مقصوصة تخرج من حدود القسم فوق نقاط.",
        content: {
          heading: "Modern Interior Design Studio",
          text: "Carefully chosen furniture and designs that give your home a quiet elegance and a comfort you live with every day.",
          buttonLabel: "Shop Now",
          buttonHref: "/products",
          button2Label: "Explore",
          button2Href: "/about",
          image: art("02", "couch.png"),
        },
      },
      {
        type: "xs_showcase",
        label: "Products 02",
        labelAr: "منتجات ٠٢",
        description: "A few words and a button, then three of your products that lift onto a tinted block on hover.",
        descriptionAr: "كلمات قليلة وزر، ثم ثلاثة من منتجاتك ترتفع فوق خلفية ملوّنة عند المرور.",
        content: { heading: "Crafted with excellent material.", text: "Carefully chosen furniture and designs that give your home a quiet elegance and a comfort you live with every day.", buttonLabel: "Explore", buttonHref: "/products", limit: 3 },
      },
      {
        type: "xs_features",
        label: "Reasons 02",
        labelAr: "أسباب ٠٢",
        description: "Four reasons with line icons in two columns, beside a rounded picture on a field of dots.",
        descriptionAr: "أربعة أسباب بأيقونات خطية في عمودين، بجانب صورة بحواف دائرية فوق نقاط.",
        content: {
          heading: "Why Choose Us",
          text: "Carefully chosen furniture and designs that give your home a quiet elegance and a comfort you live with every day.",
          image: art("02", "why-choose-us-img.jpg"),
          items: [
            { icon: "truck", title: "Fast & Free Shipping", text: "Free delivery to your door, carefully wrapped and on time." },
            { icon: "bag", title: "Easy to Shop", text: "Browse, choose and order in a few clicks, with clear prices." },
            { icon: "support", title: "24/7 Support", text: "Our team helps you choose, before and after you buy." },
            { icon: "return", title: "Hassle Free Returns", text: "Changed your mind? Returns are simple and free of fuss." },
          ],
        },
      },
      {
        type: "xs_split",
        label: "Pictures and list 02",
        labelAr: "صور وقائمة ٠٢",
        description: "Three overlapping rounded pictures on one side; a heading, a paragraph, a ticked list and a button on the other.",
        descriptionAr: "ثلاث صور متداخلة بحواف دائرية في جهة، وعنوان وفقرة وقائمة نقاط وزر في الجهة الأخرى.",
        content: {
          images: [art("02", "img-grid-1.jpg"), art("02", "img-grid-2.jpg"), art("02", "img-grid-3.jpg")],
          heading: "We Help You Make Modern Interior Design",
          text: "We design modern furniture that brings comfort and quality together, giving every corner of your home a warm touch that lasts for years.",
          points: ["Modern designs thought out for every space", "Solid materials built to last for years", "Free design advice for your room", "Delivery and assembly at your home"],
          buttonLabel: "Explore",
          buttonHref: "/products",
        },
      },
      {
        type: "xs_minis",
        label: "Small cards 02",
        labelAr: "كروت صغيرة ٠٢",
        description: "Three of your products as small cards side by side: a picture on a tinted square, the name and a link.",
        descriptionAr: "ثلاثة من منتجاتك في كروت صغيرة متجاورة: صورة على مربع ملوّن، والاسم ورابط.",
        content: { limit: 3, linkLabel: "Read More" },
      },
      {
        type: "xs_quotes",
        label: "Quotes 02",
        labelAr: "آراء ٠٢",
        description: "Your customers' words one at a time, with a round picture, arrows at the sides and dots underneath.",
        descriptionAr: "آراء عملائك واحدًا بعد الآخر، مع صورة دائرية وأسهم على الجانبين ونقاط في الأسفل.",
        content: {
          heading: "Testimonials",
          items: [
            { quote: "We furnished our whole living room from them, and it turned out better than we imagined. The materials are excellent and the finish is precise; their design team helped us pick the right colours and sizes for our space, and delivery and assembly came exactly on time. We will be back for sure.", name: "Maria Jones", role: "CEO, Co-Founder, XYZ Inc.", image: art("02", "person-1.png") },
            { quote: "I was looking for a comfortable chair for my reading corner and found a design that is both cosy and modern. You can feel the quality at first touch, and customer service was helpful and quick to reply. I recommend them to anyone furnishing a home.", name: "Maria Jones", role: "CEO, Co-Founder, XYZ Inc.", image: art("02", "person-1.png") },
          ],
        },
      },
      {
        type: "xs_newsletter",
        label: "Newsletter 02",
        labelAr: "نشرة بريدية 02",
        description: "A heading, a line and a one-line email sign-up. Addresses arrive in your Contacts, marked as agreeing to hear from you.",
        descriptionAr: "عنوان وسطر وخانة اشتراك بالبريد. العناوين تصل إلى جهات الاتصال مع موافقة أصحابها على مراسلتك.",
        content: { heading: "Subscribe to Newsletter", text: "Be the first to see our new designs and offers.", placeholder: "Enter your email", buttonLabel: "Subscribe" },
      },
      {
        type: "xs_posts",
        label: "Articles 02",
        labelAr: "مقالات 02",
        description: "Three article cards with rounded pictures, under a heading with a link to all of them. You write each card.",
        descriptionAr: "ثلاث بطاقات مقالات بصور مستديرة الحواف تحت عنوان ورابط للكل. تكتب كل بطاقة بنفسك.",
        content: {
          heading: "Recent Blog", linkLabel: "View All Posts", linkHref: "",
          items: [
            { image: art("02", "post-1.jpg"), meta: "by Kristin Watson on Dec 19, 2021", title: "First Time Home Owner Ideas", text: "", linkLabel: "", href: "" },
            { image: art("02", "post-2.jpg"), meta: "by Robert Fox on Dec 15, 2021", title: "How To Keep Your Furniture Clean", text: "", linkLabel: "", href: "" },
            { image: art("02", "post-3.jpg"), meta: "by Kristin Watson on Dec 12, 2021", title: "Small Space Furniture Apartment Ideas", text: "", linkLabel: "", href: "" },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 02",
        labelAr: "عنوان صفحة ٠٢",
        description: "",
        descriptionAr: "",
        content: { heading: "Services", image: "" },
        page: { path: "/services", title: "Services" },
        library: false,
      },
      {
        type: "xs_features",
        label: "Reasons 02",
        labelAr: "أسباب ٠٢",
        description: "",
        descriptionAr: "",
        content: {
          heading: "Our Services",
          text: "Carefully chosen furniture and designs that give your home a quiet elegance and a comfort you live with every day.",
          image: art("02", "why-choose-us-img.jpg"),
          items: [
            { icon: "truck", title: "Fast & Free Shipping", text: "Free delivery to your door, carefully wrapped and on time." },
            { icon: "bag", title: "Easy to Shop", text: "Browse, choose and order in a few clicks, with clear prices." },
            { icon: "support", title: "24/7 Support", text: "Our team helps you choose, before and after you buy." },
            { icon: "return", title: "Hassle Free Returns", text: "Changed your mind? Returns are simple and free of fuss." },
          ],
        },
        page: { path: "/services", title: "Services" },
        library: false,
      },
      {
        type: "xs_showcase",
        label: "Products 02",
        labelAr: "منتجات ٠٢",
        description: "",
        descriptionAr: "",
        content: { heading: "Crafted with excellent material.", text: "Carefully chosen furniture and designs that give your home a quiet elegance and a comfort you live with every day.", buttonLabel: "Explore", buttonHref: "/products", limit: 3 },
        page: { path: "/services", title: "Services" },
        library: false,
      },
      {
        type: "xs_title",
        label: "Page title 02",
        labelAr: "عنوان صفحة 02",
        description: "",
        descriptionAr: "",
        content: { heading: "About us", image: "" },
        page: { path: "/about", title: "About us" },
        library: false,
      },
      {
        type: "xs_team",
        label: "Team 02",
        labelAr: "فريق ٠٢",
        description: "The people behind the store in a row: a picture, a name, a role and a line each.",
        descriptionAr: "أصحاب المتجر في صف: صورة واسم ووظيفة وسطر لكل واحد.",
        content: {
          heading: "Our Team",
          items: [
            { image: art("02", "person_1.jpg"), name: "Lawson Arnold", role: "CEO, Founder, Atty.", text: "A passion for design and years of experience turning houses into comfortable homes that reflect the people who live in them." },
            { image: art("02", "person_2.jpg"), name: "Jeremy Walker", role: "CEO, Founder, Atty.", text: "A passion for design and years of experience turning houses into comfortable homes that reflect the people who live in them." },
            { image: art("02", "person_3.jpg"), name: "Patrik White", role: "CEO, Founder, Atty.", text: "A passion for design and years of experience turning houses into comfortable homes that reflect the people who live in them." },
            { image: art("02", "person_4.jpg"), name: "Kathryn Ryan", role: "CEO, Founder, Atty.", text: "A passion for design and years of experience turning houses into comfortable homes that reflect the people who live in them." },
          ],
        },
        page: { path: "/about", title: "About us" },
      },
      {
        type: "xs_title",
        label: "Page title 02",
        labelAr: "عنوان صفحة ٠٢",
        description: "The page's name in large white letters on deep green.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة على أخضر غامق.",
        content: { heading: "Contact", image: "" },
        page: { path: "/contact", title: "Contact us" },
      },
      {
        type: "xs_contact",
        label: "Contact 02",
        labelAr: "تواصل ٠٢",
        description: "A message form on a white rounded card beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة على كارت أبيض بحواف دائرية بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Get In Touch",
          contactPlaceholder: "Email address",
          messagePlaceholder: "Message",
          buttonLabel: "Send Message",
          info: [
            { icon: "address", title: "Address", text: "Mohandessin, Giza" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
          ],
        },
        page: { path: "/contact", title: "Contact us" },
      },
    ],
  },
  {
    look: "03",
    bands: [
      {
        type: "xs_banners",
        label: "Collections 03",
        labelAr: "مجموعات ٠٣",
        description: "A centred serif heading and a line, then three tall pictures that zoom on hover with their words underneath.",
        descriptionAr: "عنوان في المنتصف وسطر، ثم ثلاث صور طولية تكبر عند المرور والكلام تحتها.",
        content: {
          variant: "card",
          heading: "New Collections",
          text: "New pieces arrive every week, in chosen fabrics with thoughtful details for an effortless, elegant look. Explore the collection and pick what feels like you.",
          items: [
            { image: art("03", "banner-image-6.jpg"), title: "Soft leather jackets", text: "Soft-touch leather and modern cuts that finish your look in every season.", linkLabel: "Discover now", href: "/products" },
            { image: art("03", "banner-image-1.jpg"), title: "Soft leather jackets", text: "Soft-touch leather and modern cuts that finish your look in every season.", linkLabel: "Discover now", href: "/products" },
            { image: art("03", "banner-image-2.jpg"), title: "Soft leather jackets", text: "Soft-touch leather and modern cuts that finish your look in every season.", linkLabel: "Discover now", href: "/products" },
          ],
        },
      },
      {
        type: "xs_features",
        label: "Promises 03",
        labelAr: "وعود ٠٣",
        description: "Four centred columns: a thin line icon, a serif title and a sentence each.",
        descriptionAr: "أربعة أعمدة في المنتصف: أيقونة خطية رفيعة وعنوان وجملة لكل عمود.",
        content: {
          items: [
            { icon: "support", image: art("03", "ico-1.svg"), title: "Book An Appointment", text: "Book a styling visit at a time that suits you." },
            { icon: "bag", image: art("03", "ico-2.svg"), title: "Pick up in store", text: "Order online and collect from our store the same day." },
            { icon: "truck", image: art("03", "ico-3.svg"), title: "Special packaging", text: "Every order arrives in a gift-ready box." },
            { icon: "return", image: art("03", "ico-4.svg"), title: "Free global returns", text: "Easy, free returns within 14 days." },
          ],
        },
      },
      {
        type: "xs_banners",
        label: "Category tiles 03",
        labelAr: "أقسام ٠٣",
        description: "",
        descriptionAr: "",
        content: {
          variant: "tile",
          items: [
            { image: art("03", "cat-item1.jpg"), title: "Shop for men", href: "/products" },
            { image: art("03", "cat-item2.jpg"), title: "Shop for women", href: "/products" },
            { image: art("03", "cat-item3.jpg"), title: "Shop accessories", href: "/products" },
          ],
        },
        library: false,
      },
      {
        type: "xs_products",
        label: "Product row 03",
        labelAr: "صف منتجات ٠٣",
        description: "An upper-case heading with a link to all products across from it, then four of your products with serif names.",
        descriptionAr: "عنوان بحروف كبيرة ومقابله رابط لكل المنتجات، ثم أربعة من منتجاتك.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", openLabel: "Add to cart", viewLabel: "Add to cart", heading: "Our New Arrivals", linkLabel: "View All Products", linkHref: "/products", limit: 8, layout: "slider", showTabs: false, showSearch: false },
      },
      {
        type: "xs_split",
        label: "Collection 03",
        labelAr: "مجموعة ٠٣",
        description: "One tall picture beside a white panel with an upper-case heading, a paragraph and a square dark button, on a pale ground.",
        descriptionAr: "صورة طولية بجانب لوحة بيضاء فيها عنوان وفقرة وزر مربع غامق، على خلفية فاتحة.",
        content: {
          images: [art("03", "single-image-2.jpg")],
          heading: "Classic winter collection",
          text: "Warmth without giving up style: coats, knits and essentials in premium fabrics and calm colours, made to stay with you all season and match every look.",
          buttonLabel: "Shop Collection",
          buttonHref: "/products",
        },
      },
      {
        type: "xs_products",
        label: "Product row 03",
        labelAr: "صف منتجات ٠٣",
        description: "",
        descriptionAr: "",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", openLabel: "Add to cart", viewLabel: "Add to cart", heading: "Best Selling Items", linkLabel: "View All Products", linkHref: "/products", limit: 8, layout: "slider", showTabs: false, showSearch: false },
        library: false,
      },
      {
        type: "xs_video",
        label: "Video 03",
        labelAr: "فيديو ٠٣",
        description: "A film under an optional heading. Paste a YouTube or Vimeo link, or the address of a video file.",
        descriptionAr: "فيديو تحت عنوان اختياري. الصق رابط يوتيوب أو فيميو، أو رابط ملف فيديو.",
        content: { heading: "", url: "" },
      },
      {
        type: "xs_quotes",
        label: "Quotes 03",
        labelAr: "آراء ٠٣",
        description: "Your customers' words in a large serif, one at a time, on a pale ground.",
        descriptionAr: "آراء عملائك بخط كبير، واحدًا بعد الآخر، على خلفية فاتحة.",
        content: {
          heading: "WE LOVE GOOD COMPLIMENT",
          items: [
            { quote: "More than expected crazy soft, flexible and best fitted white simple denim shirt.", name: "casual way" },
            { quote: "Best fitted white denim shirt more than expected crazy soft, flexible", name: "uptop" },
            { quote: "Best fitted white denim shirt more white denim than expected flexible crazy soft.", name: "Denim craze" },
          ],
        },
      },
      {
        type: "xs_gallery",
        label: "Logo bar 03",
        labelAr: "شريط شعارات 03",
        description: "",
        descriptionAr: "",
        content: { variant: "logos", images: [art("03", "logo1.png"), art("03", "logo2.png"), art("03", "logo3.png"), art("03", "logo4.png"), art("03", "logo5.png")] },
        library: false,
      },
      {
        type: "xs_newsletter",
        label: "Newsletter 03",
        labelAr: "نشرة بريدية 03",
        description: "A heading, a line and a one-line email sign-up. Addresses arrive in your Contacts, marked as agreeing to hear from you.",
        descriptionAr: "عنوان وسطر وخانة اشتراك بالبريد. العناوين تصل إلى جهات الاتصال مع موافقة أصحابها على مراسلتك.",
        content: { heading: "Sign Up for our newsletter", text: "Sign up to get the latest news and offers.", placeholder: "Your Email Address", buttonLabel: "Sign Up" },
      },
      {
        type: "xs_gallery",
        label: "Picture row 03",
        labelAr: "صف صور 03",
        description: "A row of square pictures edge to edge that zoom on hover; point them at your Instagram.",
        descriptionAr: "صف صور مربعة متلاصقة تكبر عند المرور؛ اربطها بحسابك على إنستجرام.",
        content: { images: [art("03", "insta-item1.jpg"), art("03", "insta-item2.jpg"), art("03", "insta-item3.jpg"), art("03", "insta-item4.jpg"), art("03", "insta-item5.jpg"), art("03", "insta-item6.jpg")] },
      },
      {
        type: "xs_posts",
        label: "Articles 03",
        labelAr: "مقالات 03",
        description: "Three article cards: a picture, a small line in capitals, a light serif title and a sentence. You write each card.",
        descriptionAr: "ثلاث بطاقات مقالات: صورة وسطر صغير وعنوان خفيف وجملة. تكتب كل بطاقة بنفسك.",
        content: {
          heading: "Read Blog Posts", linkLabel: "View All", linkHref: "",
          items: [
            { image: art("03", "post-1.jpg"), meta: "Fashion / jul 11, 2022", title: "How to look outstanding in pastel", text: "A simple guide to wearing soft pastel shades in your everyday looks, with a striking touch...", linkLabel: "", href: "" },
            { image: art("03", "post-2.jpg"), meta: "Fashion / jul 11, 2022", title: "Top 10 fashion trend for summer", text: "From relaxed cuts to bright colours, discover what defines this summer's fashion...", linkLabel: "", href: "" },
            { image: art("03", "post-3.jpg"), meta: "Fashion / jul 11, 2022", title: "Crazy fashion with unique moment", text: "From relaxed cuts to bright colours, discover what defines this summer's fashion...", linkLabel: "", href: "" },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 03",
        labelAr: "عنوان صفحة ٠٣",
        description: "The page's name in a large upper-case serif on a pale ground.",
        descriptionAr: "اسم الصفحة بخط كبير على خلفية فاتحة.",
        content: { heading: "Contact", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 03",
        labelAr: "تواصل ٠٣",
        description: "A message form with a square button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر مربع بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Get in touch",
          contactPlaceholder: "Your Email Address",
          messagePlaceholder: "Write your message here",
          buttonLabel: "Submit",
          info: [
            { icon: "address", title: "Office", text: "Heliopolis, Cairo" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "04",
    bands: [
      {
        type: "xs_banners",
        label: "Category mosaic 04",
        labelAr: "موزاييك أقسام ٠٤",
        description: "One large picture with a script title and a line, beside four smaller ones, each with a red-underlined link.",
        descriptionAr: "صورة كبيرة بعنوان بخط يدوي وسطر، وبجانبها أربع صور أصغر، ولكل واحدة رابط تحته خط أحمر.",
        content: {
          variant: "mosaic",
          items: [
            { image: art("04", "category-1.jpg"), title: "Women’s fashion", text: "Elegant pieces that carry you from morning to evening, in comfortable fabrics and cuts that flatter you.", linkLabel: "Shop Now", href: "/products" },
            { image: art("04", "category-2.jpg"), title: "Men’s fashion", text: "358 items", linkLabel: "Shop Now", href: "/products" },
            { image: art("04", "category-3.jpg"), title: "Kid’s fashion", text: "273 items", linkLabel: "Shop Now", href: "/products" },
            { image: art("04", "category-4.jpg"), title: "Cosmetics", text: "159 items", linkLabel: "Shop Now", href: "/products" },
            { image: art("04", "category-5.jpg"), title: "Accessories", text: "792 items", linkLabel: "Shop Now", href: "/products" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 04",
        labelAr: "شبكة منتجات ٠٤",
        description: "A heading with a short red rule under it and your collections as tabs across from it, over four columns of your products.",
        descriptionAr: "عنوان تحته خط أحمر قصير ومقابله أقسامك كتبويبات، فوق أربعة أعمدة من منتجاتك.",
        content: { searchLabel: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", allLabel: "All", searchPlaceholder: "Search here.....", heading: "New product", limit: 8, showSearch: false },
      },
      {
        type: "xs_slider",
        label: "Banner 04",
        labelAr: "بانر ٠٤",
        description: "A short wide picture with a small red line, a large script heading and an underlined link in the middle.",
        descriptionAr: "صورة عريضة قصيرة في وسطها سطر أحمر صغير وعنوان كبير بخط يدوي ورابط تحته خط.",
        content: {
          slides: [
            { image: art("04", "banner-1.jpg"), eyebrow: "The Chloe Collection", heading: "The Project Jacket", buttonLabel: "Shop Now", buttonHref: "/products" },
            { image: art("04", "banner-1.jpg"), eyebrow: "The Chloe Collection", heading: "The Project Jacket", buttonLabel: "Shop Now", buttonHref: "/products" },
          ],
        },
      },
      {
        type: "xs_minis",
        label: "Small rows 04",
        labelAr: "صفوف صغيرة ٠٤",
        description: "Your products as small rows in three columns: a square picture, the name and a link.",
        descriptionAr: "منتجاتك في صفوف صغيرة على ثلاثة أعمدة: صورة مربعة والاسم ورابط.",
        content: { limit: 9, linkLabel: "Shop Now" },
      },
      {
        type: "xs_split",
        label: "Offer 04",
        labelAr: "عرض ٠٤",
        description: "A picture beside a soft grey panel with a large red script heading, a line and an underlined link.",
        descriptionAr: "صورة بجانب لوحة رمادية فاتحة فيها عنوان أحمر كبير بخط يدوي وسطر ورابط تحته خط.",
        content: { images: [art("04", "discount.jpg")], heading: "Summer 2019", text: "Sale 50%", buttonLabel: "Shop Now", buttonHref: "/products" },
      },
      {
        type: "xs_features",
        label: "Services 04",
        labelAr: "خدمات ٠٤",
        description: "Four promises in one row, each a red line icon beside a bold title and a short line.",
        descriptionAr: "أربعة وعود في صف واحد، كل وعد أيقونة حمراء بجانب عنوان عريض وسطر قصير.",
        content: {
          items: [
            { icon: "truck", image: art("04", "ico-1.svg"), title: "Free Shipping", text: "On all orders over EGP 1,500" },
            { icon: "return", image: art("04", "ico-2.svg"), title: "Money Back Guarantee", text: "If good have Problems" },
            { icon: "support", image: art("04", "ico-3.svg"), title: "Online Support 24/7", text: "Dedicated support" },
            { icon: "bag", image: art("04", "ico-4.svg"), title: "Payment Secure", text: "100% secure payment" },
          ],
        },
      },
      {
        type: "xs_gallery",
        label: "Picture row 04",
        labelAr: "صف صور 04",
        description: "A row of square pictures edge to edge that zoom on hover; point them at your Instagram.",
        descriptionAr: "صف صور مربعة متلاصقة تكبر عند المرور؛ اربطها بحسابك على إنستجرام.",
        content: { images: [art("04", "insta-1.jpg"), art("04", "insta-2.jpg"), art("04", "insta-3.jpg"), art("04", "insta-4.jpg"), art("04", "insta-5.jpg"), art("04", "insta-6.jpg")] },
      },
      {
        type: "xs_title",
        label: "Page title 04",
        labelAr: "عنوان صفحة ٠٤",
        description: "The page's name in a large script on a soft grey ground.",
        descriptionAr: "اسم الصفحة بخط يدوي كبير على خلفية رمادية فاتحة.",
        content: { heading: "Contact", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 04",
        labelAr: "تواصل ٠٤",
        description: "A message form with a red button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر أحمر بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Send message",
          contactPlaceholder: "Email",
          messagePlaceholder: "Message",
          buttonLabel: "Send message",
          info: [
            { icon: "address", title: "Address", text: "Dokki, Giza" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Support", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "05",
    bands: [
      {
        type: "xs_slider",
        label: "Hero 05",
        labelAr: "واجهة ٠٥",
        description: "A tall picture with a small red line, a bold heading, a sentence and a black square button on the start side.",
        descriptionAr: "صورة طويلة وفي جانبها سطر أحمر صغير وعنوان عريض وجملة وزر أسود مربع.",
        content: {
          slides: [
            { image: art("05", "hero-1.jpg"), eyebrow: "Summer Collection", heading: "Fall - Winter Collections 2030", text: "A specialist label creating luxury essentials. Ethically crafted with an unwavering commitment to exceptional quality.", buttonLabel: "Shop Now", buttonHref: "/products" },
            { image: art("05", "hero-2.jpg"), eyebrow: "Summer Collection", heading: "Fall - Winter Collections 2030", text: "A specialist label creating luxury essentials. Ethically crafted with an unwavering commitment to exceptional quality.", buttonLabel: "Shop Now", buttonHref: "/products" },
          ],
        },
      },
      {
        type: "xs_banners",
        label: "Collections 05",
        labelAr: "مجموعات ٠٥",
        description: "Three pictures set at stepped heights, each with a bold title and a spaced-out underlined link beneath.",
        descriptionAr: "ثلاث صور على ارتفاعات متدرجة، تحت كل واحدة عنوان عريض ورابط تحته خط.",
        content: {
          variant: "card",
          items: [
            { image: art("05", "banner-1.jpg"), title: "Clothing Collections 2030", linkLabel: "Shop Now", href: "/products" },
            { image: art("05", "banner-2.jpg"), title: "Accessories", linkLabel: "Shop Now", href: "/products" },
            { image: art("05", "banner-3.jpg"), title: "Shoes Spring 2030", linkLabel: "Shop Now", href: "/products" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 05",
        labelAr: "شبكة منتجات ٠٥",
        description: "Your collections as large bold tabs in the middle, over four columns of your products.",
        descriptionAr: "أقسامك كتبويبات كبيرة عريضة في المنتصف، فوق أربعة أعمدة من منتجاتك.",
        content: { searchLabel: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", allLabel: "Best Sellers", searchPlaceholder: "Search...", openLabel: "+ Add To Cart", limit: 8, showSearch: false },
      },
      {
        type: "xs_split",
        label: "Deal 05",
        labelAr: "عرض ٠٥",
        description: "A picture beside a small red line, a bold heading and a black square button, on a warm ground.",
        descriptionAr: "صورة بجانب سطر أحمر صغير وعنوان عريض وزر أسود مربع، على خلفية دافئة.",
        content: { images: [art("05", "product-sale.png")], heading: "Multi-pocket Chest Bag Black", text: "Deal Of The Week", buttonLabel: "Shop Now", buttonHref: "/products" },
      },
      {
        type: "xs_gallery",
        label: "Picture row 05",
        labelAr: "صف صور 05",
        description: "A row of square pictures edge to edge that zoom on hover, under a centred heading; point them at your Instagram.",
        descriptionAr: "صف صور مربعة متلاصقة تكبر عند المرور، تحت عنوان في المنتصف؛ اربطها بحسابك على إنستجرام.",
        content: { heading: "Instagram", text: "Follow us on Instagram for our latest looks and behind-the-scenes shoots, and be the first to hear about new offers.", images: [art("05", "instagram-1.jpg"), art("05", "instagram-2.jpg"), art("05", "instagram-3.jpg"), art("05", "instagram-4.jpg"), art("05", "instagram-5.jpg"), art("05", "instagram-6.jpg")] },
      },
      {
        type: "xs_posts",
        label: "Articles 05",
        labelAr: "مقالات 05",
        description: "Three article cards whose words sit on a white card climbing onto the picture, with an underlined link. You write each card.",
        descriptionAr: "ثلاث بطاقات مقالات، الكلام فيها على بطاقة بيضاء تصعد فوق الصورة مع رابط تحته خط. تكتب كل بطاقة بنفسك.",
        content: {
          heading: "Fashion New Trends",
          items: [
            { image: art("05", "post-1.jpg"), meta: "16 February 2020", title: "What Curling Irons Are The Best Ones", text: "", linkLabel: "Read More", href: "" },
            { image: art("05", "post-2.jpg"), meta: "21 February 2020", title: "Eternity Bands Do Last Forever", text: "", linkLabel: "Read More", href: "" },
            { image: art("05", "post-3.jpg"), meta: "28 February 2020", title: "The Health Benefits Of Sunglasses", text: "", linkLabel: "Read More", href: "" },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 05",
        labelAr: "عنوان صفحة 05",
        description: "",
        descriptionAr: "",
        content: { heading: "About Us", image: "" },
        page: { path: "/about", title: "About Us" },
        library: false,
      },
      {
        type: "xs_story",
        label: "Story 05",
        labelAr: "قصة ٠٥",
        description: "Text beside a picture; add more parts and they swap sides.",
        descriptionAr: "نص بجانب صورة؛ أضف أجزاء أخرى فيتبادلان الجهة.",
        content: {
          items: [
            {
              title: "Who We Are ?",
              body: "We are an Egyptian label born from a passion for detail, designing premium essentials that fit the rhythm of your day and stay with you for years.\n\nWe choose our fabrics with care and work with skilled local workshops, because we believe real quality starts with respect for the craft and the people behind it.\n\nOur goal is simple: that you find something here that speaks for you, with smooth shopping and service that looks after you before and after your order.",
              quote: "Going out after work? Take your butane curling iron with you to the office, heat it up, style your hair before you leave the office and you won’t have to make a trip back home.",
              quoteAuthor: "Augusta Schultz",
              image: art("05", "about-us.jpg"),
            },
          ],
        },
        page: { path: "/about", title: "About Us" },
      },
      {
        type: "xs_team",
        label: "Team 05",
        labelAr: "فريق ٠٥",
        description: "The people behind the store in a row: a picture, a name, a role and a line each.",
        descriptionAr: "أصحاب المتجر في صف: صورة واسم ووظيفة وسطر لكل واحد.",
        content: {
          heading: "Meet Our Team",
          items: [
            { image: art("05", "team-1.jpg"), name: "John Smith", role: "Fashion Design" },
            { image: art("05", "team-2.jpg"), name: "Christine Wise", role: "C.E.O" },
            { image: art("05", "team-3.jpg"), name: "Sean Robbins", role: "Manager" },
            { image: art("05", "team-4.jpg"), name: "Lucy Myers", role: "Delivery" },
          ],
        },
        page: { path: "/about", title: "About Us" },
      },
      {
        type: "xs_gallery",
        label: "Logo bar 05",
        labelAr: "شريط شعارات 05",
        description: "",
        descriptionAr: "",
        content: { variant: "logos", images: [art("05", "client-1.png"), art("05", "client-2.png"), art("05", "client-3.png"), art("05", "client-4.png"), art("05", "client-5.png"), art("05", "client-6.png")] },
        page: { path: "/about", title: "About Us" },
        library: false,
      },
      {
        type: "xs_title",
        label: "Page title 05",
        labelAr: "عنوان صفحة ٠٥",
        description: "The page's name in bold on a warm ground.",
        descriptionAr: "اسم الصفحة بخط عريض على خلفية دافئة.",
        content: { heading: "Contacts", image: "" },
        page: { path: "/contact", title: "Contacts" },
      },
      {
        type: "xs_contact",
        label: "Contact 05",
        labelAr: "تواصل ٠٥",
        description: "A message form with a black square button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر أسود مربع بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Contact Us",
          contactPlaceholder: "Email",
          messagePlaceholder: "Message",
          buttonLabel: "Send Message",
          info: [
            { icon: "address", title: "Our Store", text: "Heliopolis, Cairo" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contacts" },
      },
    ],
  },
  {
    look: "06",
    bands: [
      {
        type: "xs_slider",
        label: "Banner 06",
        labelAr: "بانر ٠٦",
        description: "A short dimmed picture with a light upper-case line, a large heading and a white square button in the middle.",
        descriptionAr: "صورة قصيرة معتّمة في وسطها سطر فاتح وعنوان كبير وزر أبيض مربع.",
        content: {
          slides: [
            { image: art("06", "carousel-1.jpg"), eyebrow: "10% Off Your First Order", heading: "Fashionable Dress", buttonLabel: "Shop Now", buttonHref: "/products" },
            { image: art("06", "carousel-2.jpg"), eyebrow: "10% Off Your First Order", heading: "Reasonable Price", buttonLabel: "Shop Now", buttonHref: "/products" },
          ],
        },
      },
      {
        type: "xs_features",
        label: "Promises 06",
        labelAr: "وعود ٠٦",
        description: "Four framed boxes in a row, each a rose line icon beside a bold line.",
        descriptionAr: "أربعة مربعات بإطار في صف واحد، في كل مربع أيقونة وردية بجانب سطر عريض.",
        content: {
          items: [
            { icon: "support", image: art("06", "ico-1.svg"), title: "Quality Product", text: "" },
            { icon: "truck", image: art("06", "ico-2.svg"), title: "Free Shipping", text: "" },
            { icon: "return", image: art("06", "ico-3.svg"), title: "14-Day Return", text: "" },
            { icon: "bag", image: art("06", "ico-4.svg"), title: "24/7 Support", text: "" },
          ],
        },
      },
      {
        type: "xs_banners",
        label: "Category cards 06",
        labelAr: "كروت أقسام ٠٦",
        description: "Framed cards, each with a small count over a picture that zooms on hover and the category's name beneath.",
        descriptionAr: "كروت بإطار، في كل كارت عدد صغير فوق صورة تكبر عند المرور واسم القسم تحتها.",
        content: {
          variant: "card",
          items: [
            { image: art("06", "cat-1.jpg"), title: "Men's dresses", text: "15 Products", href: "/products" },
            { image: art("06", "cat-2.jpg"), title: "Women's dresses", text: "15 Products", href: "/products" },
            { image: art("06", "cat-3.jpg"), title: "Baby's dresses", text: "15 Products", href: "/products" },
          ],
        },
      },
      {
        type: "xs_banners",
        label: "Offer panels 06",
        labelAr: "عروض ٠٦",
        description: "",
        descriptionAr: "",
        content: {
          items: [
            { image: art("06", "offer-1.png"), title: "Spring Collection", text: "20% off the all order", linkLabel: "Shop Now", href: "/products" },
            { image: art("06", "offer-2.png"), title: "Winter Collection", text: "20% off the all order", linkLabel: "Shop Now", href: "/products" },
          ],
        },
        library: false,
      },
      {
        type: "xs_products",
        label: "Product grid 06",
        labelAr: "شبكة منتجات ٠٦",
        description: "A centred heading between two short rules, over four columns of your products in framed cards.",
        descriptionAr: "عنوان في المنتصف بين خطين قصيرين، فوق أربعة أعمدة من منتجاتك في كروت بإطار.",
        content: { allLabel: "All Products", searchLabel: "Search", loadMoreLabel: "Load More", searchPlaceholder: "Search by name", viewLabel: "View Detail", openLabel: "Add To Cart", heading: "Trandy Products", limit: 8, showTabs: false, showSearch: false },
      },
      {
        type: "xs_newsletter",
        label: "Newsletter 06",
        labelAr: "نشرة بريدية 06",
        description: "A heading, a line and a one-line email sign-up. Addresses arrive in your Contacts, marked as agreeing to hear from you.",
        descriptionAr: "عنوان وسطر وخانة اشتراك بالبريد. العناوين تصل إلى جهات الاتصال مع موافقة أصحابها على مراسلتك.",
        content: { heading: "Stay Updated", text: "Subscribe to our newsletter for the latest collections and exclusive offers before anyone else.", placeholder: "Email Goes Here", buttonLabel: "Subscribe" },
      },
      {
        type: "xs_title",
        label: "Page title 06",
        labelAr: "عنوان صفحة ٠٦",
        description: "The page's name in bold upper-case on a pale blue ground.",
        descriptionAr: "اسم الصفحة بحروف كبيرة عريضة على خلفية زرقاء فاتحة.",
        content: { heading: "Contact Us", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 06",
        labelAr: "تواصل ٠٦",
        description: "A message form with a rose square button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر وردي مربع بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Contact For Any Queries",
          contactPlaceholder: "Your Email",
          messagePlaceholder: "Message",
          buttonLabel: "Send Message",
          info: [
            { icon: "address", title: "Store", text: "Dokki, Giza" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "07",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 07",
        labelAr: "واجهة ٠٧",
        description: "A small orange line and a very large green heading on a photograph, with a rounded picture beside them.",
        descriptionAr: "سطر برتقالي صغير وعنوان أخضر كبير جدًا فوق صورة، وبجانبهما صورة بحواف دائرية.",
        content: { heading: "Organic Veggies & Fruits Foods", text: "100% Organic Foods", buttonLabel: "Shop Now", buttonHref: "/products", image: art("07", "hero-img-1.png") },
      },
      {
        type: "xs_features",
        label: "Promises 07",
        labelAr: "وعود ٠٧",
        description: "Four pale rounded cards, each with a line icon on an orange disc, a title and a line.",
        descriptionAr: "أربعة كروت فاتحة بحواف دائرية، في كل كارت أيقونة على دائرة برتقالية وعنوان وسطر.",
        content: {
          items: [
            { icon: "truck", image: art("07", "ico-1.svg"), title: "Free Shipping", text: "Free on orders over EGP 300" },
            { icon: "bag", image: art("07", "ico-2.svg"), title: "Security Payment", text: "100% security payment" },
            { icon: "return", image: art("07", "ico-3.svg"), title: "30 Day Return", text: "30 day money guarantee" },
            { icon: "support", image: art("07", "ico-4.svg"), title: "24/7 Support", text: "Support every time fast" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 07",
        labelAr: "شبكة منتجات ٠٧",
        description: "A bold heading with your collections as rounded pills across from it, over rounded product cards with an orange outline.",
        descriptionAr: "عنوان عريض ومقابله أقسامك كأزرار دائرية، فوق كروت منتجات بحواف دائرية وإطار برتقالي.",
        content: { searchLabel: "Search", viewLabel: "Quick View", allLabel: "All Products", searchPlaceholder: "keywords", loadMoreLabel: "View More", openLabel: "Add to cart", heading: "Our Organic Products", limit: 8, showSearch: false },
      },
      {
        type: "xs_banners",
        label: "Offer cards 07",
        labelAr: "كروت عروض ٠٧",
        description: "Three rounded cards in green, slate and orange, each a picture with a white label set into its lower edge.",
        descriptionAr: "ثلاثة كروت بحواف دائرية بالأخضر والرمادي والبرتقالي، في كل كارت صورة وتحتها بطاقة بيضاء.",
        content: {
          variant: "card",
          items: [
            { image: art("07", "featur-1.jpg"), title: "Fresh Apples", text: "20% OFF", href: "/products" },
            { image: art("07", "featur-2.jpg"), title: "Tasty Fruits", text: "Free delivery", href: "/products" },
            { image: art("07", "featur-3.jpg"), title: "Exotic Vegitable", text: "Discount 30$", href: "/products" },
          ],
        },
      },
      {
        type: "xs_split",
        label: "Offer 07",
        labelAr: "عرض ٠٧",
        description: "A very large white heading, a paragraph and an outlined button on orange, with a picture on the other side.",
        descriptionAr: "عنوان أبيض كبير جدًا وفقرة وزر بإطار على خلفية برتقالية، وفي الجهة الأخرى صورة.",
        content: {
          images: [art("07", "baner-1.png")],
          heading: "Fresh Exotic Fruits in Our Store",
          text: "We pick the finest tropical fruit from trusted farms and deliver it fresh to your door the same day.",
          buttonLabel: "BUY",
          buttonHref: "/products",
        },
      },
      {
        type: "xs_quotes",
        label: "Quotes 07",
        labelAr: "آراء ٠٧",
        description: "Your customers' words on a pale rounded card, one at a time, with a rule and the customer's picture and name beneath.",
        descriptionAr: "آراء عملائك على كارت فاتح بحواف دائرية، واحدًا بعد الآخر، وتحتها خط وصورة العميل واسمه.",
        content: {
          heading: "Our Client Saying!",
          items: [
            { quote: "I order my vegetables and fruit here every week; the quality never changes and delivery is always on time. The best choice for my home.", name: "Mona Abdelrahman", role: "Architect", image: art("07", "testimonial-1.jpg") },
            { quote: "I order my vegetables and fruit here every week; the quality never changes and delivery is always on time. The best choice for my home.", name: "Mona Abdelrahman", role: "Architect", image: art("07", "testimonial-1.jpg") },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 07",
        labelAr: "عنوان صفحة ٠٧",
        description: "The page's name in a bold white face on slate.",
        descriptionAr: "اسم الصفحة بخط أبيض عريض على خلفية رمادية غامقة.",
        content: { heading: "Contact", image: art("07", "cart-page-header-img.jpg") },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 07",
        labelAr: "تواصل ٠٧",
        description: "A message form on a pale rounded card beside your address, email and phone. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة على كارت فاتح بحواف دائرية بجانب عنوانك وبريدك وهاتفك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Get in touch",
          contactPlaceholder: "Enter Your Email",
          messagePlaceholder: "Your Message",
          buttonLabel: "Submit",
          info: [
            { icon: "address", title: "Address", text: "New Cairo, Cairo" },
            { icon: "email", title: "Mail Us", text: "Send us a message and we reply within a day" },
            { icon: "phone", title: "Telephone", text: "Call us any day from 10 am to 10 pm" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "08",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 08",
        labelAr: "واجهة ٠٨",
        description: "A very large dark heading, a paragraph and an orange gradient pill button on a pale photograph, with a product picture beside them.",
        descriptionAr: "عنوان غامق كبير جدًا وفقرة وزر برتقالي متدرج على صورة فاتحة، وبجانبهم صورة منتج.",
        content: { heading: "Nike New Collection!", text: "Discover the latest sneakers, designed to bring comfort, performance and style together. Your next step starts here.", buttonLabel: "Shop Now", buttonHref: "/products", image: art("08", "banner-img.png") },
      },
      {
        type: "xs_features",
        label: "Promises 08",
        labelAr: "وعود ٠٨",
        description: "Four promises side by side in one softly shadowed box, with thin rules between them.",
        descriptionAr: "أربعة وعود متجاورة في مربع واحد بظل خفيف، بينها خطوط رفيعة.",
        content: {
          items: [
            { icon: "truck", image: art("08", "ico-1.png"), title: "Free Delivery", text: "Free shipping on every order" },
            { icon: "return", image: art("08", "ico-2.png"), title: "Return Policy", text: "Return any item within 14 days" },
            { icon: "support", image: art("08", "ico-3.png"), title: "24/7 Support", text: "We answer any time, day or night" },
            { icon: "bag", image: art("08", "ico-4.png"), title: "Secure Payment", text: "Cash on delivery or a protected card" },
          ],
        },
      },
      {
        type: "xs_banners",
        label: "Category tiles 08",
        labelAr: "بلاطات أقسام ٠٨",
        description: "Pictures that dim on hover to show the category's name in white upper-case letters.",
        descriptionAr: "صور تعتم عند المرور ليظهر اسم القسم بحروف بيضاء كبيرة.",
        content: {
          variant: "tile",
          items: [
            { image: art("08", "c1.jpg"), title: "Sneaker for Sports", href: "/products" },
            { image: art("08", "c2.jpg"), title: "Sneaker for Sports", href: "/products" },
            { image: art("08", "c3.jpg"), title: "Product for Couple", href: "/products" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 08",
        labelAr: "شبكة منتجات ٠٨",
        description: "A centred bold heading over four columns of your products, with an orange gradient button sliding up on hover.",
        descriptionAr: "عنوان عريض في المنتصف فوق أربعة أعمدة من منتجاتك، ويصعد عند المرور زر برتقالي متدرج.",
        content: { allLabel: "All Products", searchLabel: "Search", loadMoreLabel: "Load More", searchPlaceholder: "Search Here", viewLabel: "view more", openLabel: "add to bag", heading: "Latest Products", limit: 8, showTabs: false, showSearch: false },
      },
      {
        type: "xs_split",
        label: "Hot deal 08",
        labelAr: "عرض ساخن ٠٨",
        description: "White words and a gradient button over a dimmed photograph on one half, a product picture on a pale ground on the other.",
        descriptionAr: "كلام أبيض وزر متدرج فوق صورة معتّمة في نصف، وصورة منتج على خلفية فاتحة في النصف الآخر.",
        content: { images: [art("08", "e-p1.png")], heading: "Exclusive Hot Deal Ends Soon!", text: "For everyone who loves style that respects the planet and its materials.", buttonLabel: "Shop Now", buttonHref: "/products" },
      },
      {
        type: "xs_title",
        label: "Page title 08",
        labelAr: "عنوان صفحة ٠٨",
        description: "The page's name in white on an orange gradient.",
        descriptionAr: "اسم الصفحة بالأبيض على تدرج برتقالي.",
        content: { heading: "Contact Us", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 08",
        labelAr: "تواصل ٠٨",
        description: "A message form with an orange gradient button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر برتقالي متدرج بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Send Message",
          contactPlaceholder: "Enter email address",
          messagePlaceholder: "Enter Message",
          buttonLabel: "Send Message",
          info: [
            { icon: "address", title: "Cairo, Egypt", text: "Downtown Cairo" },
            { icon: "phone", title: "Call Us", text: "Mon to Fri 9am to 6 pm" },
            { icon: "email", title: "Email Us", text: "Send us your query anytime!" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "09",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 09",
        labelAr: "واجهة ٠٩",
        description: "A tall pale band with a large plum heading, a line and a mauve button, and a product picture on the other side.",
        descriptionAr: "قسم طويل فاتح فيه عنوان بنفسجي كبير وسطر وزر موف، وفي الجهة الأخرى صورة منتج.",
        content: { heading: "Best quality pillow", text: "Deeper sleep and lasting comfort with pillows designed to support your neck and back.", buttonLabel: "Shop Now", buttonHref: "/products", image: art("09", "banner_img.png") },
      },
      {
        type: "xs_story",
        label: "Product stories 09",
        labelAr: "قصص منتجات ٠٩",
        description: "A product picture and a few large words side by side, swapping sides from one part to the next.",
        descriptionAr: "صورة منتج وكلمات كبيرة قليلة جنبًا إلى جنب، يتبادلان الجهة من جزء لآخر.",
        content: {
          items: [
            { title: "Printed memory foam brief modern throw pillow case", body: "Starting from EGP 380", image: art("09", "single_product_1.png") },
            { title: "Printed memory foam brief modern throw pillow case", body: "Starting from EGP 380", image: art("09", "single_product_2.png") },
            { title: "Printed memory foam brief modern throw pillow case", body: "Starting from EGP 380", image: art("09", "single_product_3.png") },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 09",
        labelAr: "شبكة منتجات ٠٩",
        description: "A centred heading over four columns of your products on pale squares, with mauve prices.",
        descriptionAr: "عنوان في المنتصف فوق أربعة أعمدة من منتجاتك على مربعات فاتحة، والأسعار بلون موف.",
        content: { allLabel: "All Products", searchLabel: "Search", viewLabel: "Quick View", openLabel: "Add to cart", searchPlaceholder: "Search keyword", loadMoreLabel: "Load More", heading: "Trending Items", limit: 8, showTabs: false, showSearch: false },
      },
      {
        type: "xs_quotes",
        label: "Quotes 09",
        labelAr: "آراء ٠٩",
        description: "Your customers' words in white on a plum gradient, one at a time.",
        descriptionAr: "آراء عملائك بالأبيض على تدرج بنفسجي، واحدًا بعد الآخر.",
        content: {
          items: [
            { quote: "I tried the neck pillow on my last trip and it was so comfortable that I ordered one for everyone in the family.", name: "Ahmed El Sherif", image: art("09", "client.png") },
            { quote: "I tried the neck pillow on my last trip and it was so comfortable that I ordered one for everyone in the family.", name: "Ahmed El Sherif", image: art("09", "client_1.png") },
          ],
        },
      },
      {
        type: "xs_features",
        label: "Promises 09",
        labelAr: "وعود ٠٩",
        description: "A heading and a paragraph, then four soft pale cards with a line icon and a title each.",
        descriptionAr: "عنوان وفقرة، ثم أربعة كروت فاتحة ناعمة في كل كارت أيقونة وعنوان.",
        content: {
          heading: "Your comfort deserves materials without compromise",
          text: "Our pillows are made of high-density memory foam and soft washable fabrics for ideal support and comfort that lasts for years. Every piece passes a careful quality check before it reaches your home.",
          items: [
            { icon: "bag", image: art("09", "ico-1.svg"), title: "Credit Card Support", text: "" },
            { icon: "support", image: art("09", "ico-2.svg"), title: "Online Order", text: "" },
            { icon: "truck", image: art("09", "ico-3.svg"), title: "Free Delivery", text: "" },
            { icon: "return", image: art("09", "ico-4.svg"), title: "Product with Gift", text: "" },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 09",
        labelAr: "عنوان صفحة 09",
        description: "",
        descriptionAr: "",
        content: { heading: "About", image: "" },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_story",
        label: "Story 09",
        labelAr: "قصة ٠٩",
        description: "",
        descriptionAr: "",
        content: {
          items: [
            { title: "Our Mission", body: "Our mission is simple: a calm, comfortable night's sleep in every Egyptian home. That is why we choose our materials with care and keep refining our designs for the needs of the neck, back and joints.\n\nFrom travel pillows to modern pillow covers, we believe small details make a big difference to your day, and we stand by consistent quality and service worthy of your trust.", image: art("09", "about_us_video.png") },
          ],
        },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_title",
        label: "Page title 09",
        labelAr: "عنوان صفحة ٠٩",
        description: "The page's name in a large plum face on the pale ground.",
        descriptionAr: "اسم الصفحة بخط بنفسجي كبير على الخلفية الفاتحة.",
        content: { heading: "Contact us", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 09",
        labelAr: "تواصل ٠٩",
        description: "A message form with a mauve button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر موف بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Get in Touch",
          contactPlaceholder: "Enter email address",
          messagePlaceholder: "Enter Message",
          buttonLabel: "Send Message",
          info: [
            { icon: "address", title: "Nasr City, Cairo", text: "Open daily from 10 am to 10 pm" },
            { icon: "phone", title: "Call Us", text: "Mon to Fri 9am to 6pm" },
            { icon: "email", title: "Email Us", text: "Send us your query anytime!" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "10",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 10",
        labelAr: "واجهة ١٠",
        description: "A figure standing on the start side of a soft photograph, with a red line, a very large black heading and a red square button beside it.",
        descriptionAr: "شخص واقف في جانب صورة ناعمة، وبجانبه سطر أحمر وعنوان أسود كبير جدًا وزر أحمر مربع.",
        content: { heading: "Winter Collection", text: "60% Discount", buttonLabel: "Shop Now", buttonHref: "/products", image: art("10", "hero_man.png") },
      },
      {
        type: "xs_banners",
        label: "Category pictures 10",
        labelAr: "صور أقسام ١٠",
        description: "A bold centred heading, then three pictures that zoom on hover with a small line, a title and a link over their lower edge.",
        descriptionAr: "عنوان عريض في المنتصف، ثم ثلاث صور تكبر عند المرور وعلى حافتها السفلية سطر صغير وعنوان ورابط.",
        content: {
          heading: "Shop by Category",
          items: [
            { image: art("10", "cat1.jpg"), title: "Owmen`s", text: "Best New Deals", linkLabel: "New Collection", href: "/products" },
            { image: art("10", "cat2.jpg"), title: "Winter Cloth", text: "Discount!", linkLabel: "New Collection", href: "/products" },
            { image: art("10", "cat3.jpg"), title: "Man`s Cloth", text: "Best New Deals", linkLabel: "New Collection", href: "/products" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 10",
        labelAr: "شبكة منتجات ١٠",
        description: "A large bold heading with your collections as tabs across from it, over three columns of your products with red prices.",
        descriptionAr: "عنوان عريض كبير ومقابله أقسامك كتبويبات، فوق ثلاثة أعمدة من منتجاتك بأسعار حمراء.",
        content: { searchLabel: "Search", viewLabel: "Quick View", openLabel: "Add to cart", allLabel: "All", searchPlaceholder: "Search keyword", loadMoreLabel: "Load More", heading: "Latest Products", limit: 6, showSearch: false },
      },
      {
        type: "xs_split",
        label: "Best product 10",
        labelAr: "أفضل منتج ١٠",
        description: "A large bold heading, a line and a red square button on a grey ground, with a figure standing on the other side.",
        descriptionAr: "عنوان عريض كبير وسطر وزر أحمر مربع على خلفية رمادية، وفي الجهة الأخرى شخص واقف.",
        content: { images: [art("10", "card-man.png")], heading: "Find The Best Product from Our Shop", text: "Pieces made by designers who love the details, to suit your look every day.", buttonLabel: "Shop Now", buttonHref: "/products" },
      },
      {
        type: "xs_features",
        label: "Shop method 10",
        labelAr: "طريقة التسوق ١٠",
        description: "Three framed boxes side by side, each a red line icon, a title and a sentence.",
        descriptionAr: "ثلاثة مربعات بإطار متجاورة، في كل مربع أيقونة حمراء وعنوان وجملة.",
        content: {
          items: [
            { icon: "truck", image: art("10", "ico-1.svg"), title: "Free Shipping Method", text: "Free delivery on every order, straight to your door." },
            { icon: "bag", image: art("10", "ico-2.svg"), title: "Secure Payment System", text: "Pay by card or cash on delivery, safely." },
            { icon: "support", image: art("10", "ico-3.svg"), title: "Secure Payment System", text: "A service that keeps your shopping comfortable and safe from the first order." },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 10",
        labelAr: "عنوان صفحة 10",
        description: "",
        descriptionAr: "",
        content: { heading: "About", image: art("10", "category.jpg") },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_story",
        label: "Story 10",
        labelAr: "قصة ١٠",
        description: "Text beside a picture; add more parts and they swap sides.",
        descriptionAr: "نص بجانب صورة؛ أضف أجزاء أخرى فيتبادلان الجهة.",
        content: {
          items: [
            { title: "Our Mission", body: "We believe style is for everyone, so we choose every piece with care to bring good fabric, modern design and a fair price together.\n\nFrom warm winter collections to everyday casual looks, we bring you the latest fashion with fast service and a shopping experience worthy of your trust.", image: art("10", "about_us_video.png") },
          ],
        },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_title",
        label: "Page title 10",
        labelAr: "عنوان صفحة ١٠",
        description: "The page's name in bold white over a wide picture.",
        descriptionAr: "اسم الصفحة بخط أبيض عريض فوق صورة عريضة.",
        content: { heading: "Contact us", image: art("10", "contact_hero.jpg") },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 10",
        labelAr: "تواصل ١٠",
        description: "A message form with a red square button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر أحمر مربع بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Get in Touch",
          contactPlaceholder: "Enter email address",
          messagePlaceholder: "Enter Message",
          buttonLabel: "Send Now",
          info: [
            { icon: "address", title: "Fifth Settlement, New Cairo.", text: "Open daily from 10 am to 10 pm" },
            { icon: "phone", title: "Call Us", text: "Mon to Fri 9am to 6pm" },
            { icon: "email", title: "Email Us", text: "Send us your query anytime!" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "11",
    bands: [
      {
        type: "xs_slider",
        label: "Billboard 11",
        labelAr: "واجهة ١١",
        description: "A wide picture with a very large heading on a soft blush panel and a black square button under it.",
        descriptionAr: "صورة عريضة وعليها عنوان كبير جدًا فوق لوحة وردية ناعمة وتحته زر أسود مربع.",
        content: {
          slides: [{ image: art("11", "banner-image.jpg"), heading: "Make your fashion look swanky.", buttonLabel: "Shop Now", buttonHref: "/products" }],
          autoplay: false,
        },
      },
      {
        type: "xs_features",
        label: "Services 11",
        labelAr: "خدمات ١١",
        description: "Three promises in a row, each a thin line icon beside a bold title and a sentence.",
        descriptionAr: "ثلاثة وعود في صف، كل وعد أيقونة خطية رفيعة بجانب عنوان عريض وجملة.",
        content: {
          items: [
            { icon: "truck", image: art("11", "ico-1.svg"), title: "Quick delivery", text: "Inside City delivery within 5 days" },
            { icon: "bag", image: art("11", "ico-2.svg"), title: "Pick up in store", text: "We have option of pick up in store." },
            { icon: "support", image: art("11", "ico-3.svg"), title: "Special packaging", text: "Our packaging is best for products." },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product row 11",
        labelAr: "صف منتجات ١١",
        description: "A large bold heading with an underlined link across from it, over four tall pictures of your products.",
        descriptionAr: "عنوان عريض كبير ومقابله رابط تحته خط، فوق أربع صور طولية لمنتجاتك.",
        content: { allLabel: "All Products", searchLabel: "Search", viewLabel: "Quick View", searchPlaceholder: "SEARCH..", loadMoreLabel: "Shop All", openLabel: "Add to Cart", heading: "What’s trending", linkLabel: "View all products", linkHref: "/products", limit: 8, layout: "slider", showTabs: false, showSearch: false },
      },
      {
        type: "xs_quotes",
        label: "Quotes 11",
        labelAr: "آراء ١١",
        description: "Your customers' words in a large display face on a blush ground, one at a time.",
        descriptionAr: "آراء عملائك بخط عرض كبير على خلفية وردية، واحدًا بعد الآخر.",
        content: {
          items: [
            { quote: "A great range and fabrics worth every pound! My pieces arrived on time, beautifully wrapped, and the sizes were spot on. It is now my go-to shop for every occasion.", name: "Emma Chamberlin", image: art("11", "author-image.jpg") },
            { quote: "A great range and fabrics worth every pound! My pieces arrived on time, beautifully wrapped, and the sizes were spot on. It is now my go-to shop for every occasion.", name: "Emma Chamberlin", image: art("11", "author-image.jpg") },
          ],
        },
      },
      {
        type: "xs_banners",
        label: "Category tiles 11",
        labelAr: "بلاطات أقسام ١١",
        description: "Three tall pictures edge to edge, each with a white label holding a bold title and an underlined link.",
        descriptionAr: "ثلاث صور طولية متلاصقة، على كل واحدة بطاقة بيضاء فيها عنوان عريض ورابط تحته خط.",
        content: {
          variant: "tile",
          items: [
            { image: art("11", "category-item1.jpg"), title: "Summer Outfits", linkLabel: "Shop Collections", href: "/products" },
            { image: art("11", "category-item2.jpg"), title: "Guggles", linkLabel: "Shop it now", href: "/products" },
            { image: art("11", "category-item3.jpg"), title: "Accessories", linkLabel: "Shop it now", href: "/products" },
          ],
        },
      },
      {
        type: "xs_gallery",
        label: "Logo bar 11",
        labelAr: "شريط شعارات 11",
        description: "",
        descriptionAr: "",
        content: { variant: "logos", images: [art("11", "brand-item1.svg"), art("11", "brand-item2.svg"), art("11", "brand-item3.svg"), art("11", "brand-item4.svg"), art("11", "brand-item5.svg")] },
        library: false,
      },
      {
        type: "xs_gallery",
        label: "Picture row 11",
        labelAr: "صف صور 11",
        description: "A row of square pictures edge to edge that zoom on hover, under a centred heading; point them at your Instagram.",
        descriptionAr: "صف صور مربعة متلاصقة تكبر عند المرور، تحت عنوان في المنتصف؛ اربطها بحسابك على إنستجرام.",
        content: { heading: "Shop our Instagram", images: [art("11", "insta-item1.jpg"), art("11", "insta-item2.jpg"), art("11", "insta-item3.jpg"), art("11", "insta-item4.jpg"), art("11", "insta-item5.jpg")] },
      },
      {
        type: "xs_posts",
        label: "Articles 11",
        labelAr: "مقالات 11",
        description: "Three centred article cards under a centred heading and line. You write each card.",
        descriptionAr: "ثلاث بطاقات مقالات في المنتصف تحت عنوان وسطر في المنتصف. تكتب كل بطاقة بنفسك.",
        content: {
          heading: "Read Our News & articles about updates", linkLabel: "Read All", linkHref: "",
          items: [
            { image: art("11", "post-1.jpg"), meta: "", title: "Best Comfortable Clothes Ideas", text: "Practical tips for styling your clothes your own way.", linkLabel: "", href: "" },
            { image: art("11", "post-2.jpg"), meta: "", title: "Casual Denim Clothing for women", text: "Practical tips for styling your clothes your own way.", linkLabel: "", href: "" },
            { image: art("11", "post-3.jpg"), meta: "", title: "Best Poses for fashion photo", text: "Practical tips for styling your clothes your own way.", linkLabel: "", href: "" },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 11",
        labelAr: "عنوان صفحة ١١",
        description: "The page's name in a large display face on a blush ground.",
        descriptionAr: "اسم الصفحة بخط عرض كبير على خلفية وردية.",
        content: { heading: "Contact", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 11",
        labelAr: "تواصل ١١",
        description: "A message form with a black square button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر أسود مربع بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Any questions?",
          contactPlaceholder: "Write Your Email Here",
          messagePlaceholder: "Write Your Message Here",
          buttonLabel: "Submit",
          info: [
            { icon: "address", title: "Office", text: "Mohandessin, Giza" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "12",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 12",
        labelAr: "واجهة ١٢",
        description: "A very large thin upper-case heading and a black square button on pale blue-grey, with a product picture beside them.",
        descriptionAr: "عنوان رفيع كبير جدًا بحروف كبيرة وزر أسود مربع على رمادي مزرق فاتح، وبجانبهما صورة منتج.",
        content: { heading: "Your Products Are Great.", buttonLabel: "Shop Product", buttonHref: "/products", image: art("12", "banner-image.png") },
      },
      {
        type: "xs_features",
        label: "Services 12",
        labelAr: "خدمات ١٢",
        description: "Four promises in a row, each a thin line icon beside an upper-case title and a sentence.",
        descriptionAr: "أربعة وعود في صف، كل وعد أيقونة خطية رفيعة بجانب عنوان بحروف كبيرة وجملة.",
        content: {
          items: [
            { icon: "truck", image: art("12", "ico-1.svg"), title: "Free delivery", text: "Free delivery of your order to your door." },
            { icon: "support", image: art("12", "ico-2.svg"), title: "Quality guarantee", text: "Genuine devices with an official warranty, fully checked before shipping." },
            { icon: "return", image: art("12", "ico-3.svg"), title: "Daily offers", text: "Fresh discounts every day on the best-known brands." },
            { icon: "bag", image: art("12", "ico-4.svg"), title: "100% secure payment", text: "Pay by card or cash on delivery, safely." },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product row 12",
        labelAr: "صف منتجات ١٢",
        description: "A thin upper-case heading with an underlined link across from it, over four of your products on pale squares.",
        descriptionAr: "عنوان رفيع بحروف كبيرة ومقابله رابط تحته خط، فوق أربعة من منتجاتك على مربعات فاتحة.",
        content: { allLabel: "All Products", searchLabel: "Search", viewLabel: "Quick View", searchPlaceholder: "Type and press enter", loadMoreLabel: "Go to Shop", openLabel: "Add to Cart", heading: "Mobile Products", linkLabel: "Go to Shop", linkHref: "/products", limit: 8, layout: "slider", showTabs: false, showSearch: false },
      },
      {
        type: "xs_split",
        label: "Sale 12",
        labelAr: "تخفيضات ١٢",
        description: "A small blue line, a very large thin heading and a black square button on the pale ground, with a product picture on the other side.",
        descriptionAr: "سطر أزرق صغير وعنوان رفيع كبير جدًا وزر أسود مربع على الخلفية الفاتحة، وفي الجهة الأخرى صورة منتج.",
        content: { images: [art("12", "single-image1.png")], heading: "New year sale", text: "10% off", buttonLabel: "Shop Sale", buttonHref: "/products" },
      },
      {
        type: "xs_quotes",
        label: "Quotes 12",
        labelAr: "آراء ١٢",
        description: "Your customers' words in a large thin face, one at a time.",
        descriptionAr: "آراء عملائك بخط رفيع كبير، واحدًا بعد الآخر.",
        content: {
          items: [
            { quote: "I bought my phone and smartwatch here; both arrived genuine, carefully packed and ahead of time. Respectful service and truly competitive prices.", name: "Emma Chamberlin" },
            { quote: "I bought my phone and smartwatch here; both arrived genuine, carefully packed and ahead of time. Respectful service and truly competitive prices.", name: "Thomas John" },
          ],
        },
      },
      {
        type: "xs_newsletter",
        label: "Newsletter 12",
        labelAr: "نشرة بريدية 12",
        description: "A heading, a line and a one-line email sign-up. Addresses arrive in your Contacts, marked as agreeing to hear from you.",
        descriptionAr: "عنوان وسطر وخانة اشتراك بالبريد. العناوين تصل إلى جهات الاتصال مع موافقة أصحابها على مراسلتك.",
        content: { heading: "Subscribe Us Now", text: "Get latest news, updates and deals directly mailed to your inbox.", placeholder: "Your email address here", buttonLabel: "Subscribe" },
      },
      {
        type: "xs_gallery",
        label: "Picture row 12",
        labelAr: "صف صور 12",
        description: "A row of square pictures edge to edge that zoom on hover, under a centred heading; point them at your Instagram.",
        descriptionAr: "صف صور مربعة متلاصقة تكبر عند المرور، تحت عنوان في المنتصف؛ اربطها بحسابك على إنستجرام.",
        content: { heading: "Shop our Instagram", images: [art("12", "insta-item1.jpg"), art("12", "insta-item2.jpg"), art("12", "insta-item3.jpg"), art("12", "insta-item4.jpg"), art("12", "insta-item5.jpg")] },
      },
      {
        type: "xs_posts",
        label: "Articles 12",
        labelAr: "مقالات 12",
        description: "Three article cards: a picture, a small line in capitals and an upper-case title, under a heading with a link. You write each card.",
        descriptionAr: "ثلاث بطاقات مقالات: صورة وسطر صغير وعنوان بحروف كبيرة، تحت عنوان ورابط. تكتب كل بطاقة بنفسك.",
        content: {
          heading: "Latest Posts", linkLabel: "Read Blog", linkHref: "",
          items: [
            { image: art("12", "post-1.jpg"), meta: "feb 22, 2023 - Gadgets", title: "Get some cool gadgets in 2023", text: "", linkLabel: "", href: "" },
            { image: art("12", "post-2.jpg"), meta: "feb 25, 2023 - Technology", title: "Technology Hack You Won't Get", text: "", linkLabel: "", href: "" },
            { image: art("12", "post-3.jpg"), meta: "feb 22, 2023 - Camera", title: "Top 10 Small Camera In The World", text: "", linkLabel: "", href: "" },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 12",
        labelAr: "عنوان صفحة ١٢",
        description: "The page's name in a large thin upper-case face on the pale ground.",
        descriptionAr: "اسم الصفحة بخط رفيع كبير بحروف كبيرة على الخلفية الفاتحة.",
        content: { heading: "Contact", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 12",
        labelAr: "تواصل ١٢",
        description: "A message form with a black square button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر أسود مربع بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Any questions?",
          contactPlaceholder: "Write Your Email Here",
          messagePlaceholder: "Write Your Message Here",
          buttonLabel: "Submit",
          info: [
            { icon: "address", title: "Office", text: "Mohandessin, Giza" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "13",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 13",
        labelAr: "واجهة ١٣",
        description: "A small spaced-out line, a large heading and a blue gradient pill button on a pale photograph, with the product beside them.",
        descriptionAr: "سطر صغير متباعد الحروف وعنوان كبير وزر أزرق متدرج على صورة فاتحة، وبجانبهم المنتج.",
        content: { heading: "Smart New Future", text: "Now you can feel the Heat", buttonLabel: "Buy Now", buttonHref: "/products", image: art("13", "header-img.png") },
      },
      {
        type: "xs_split",
        label: "Story 13",
        labelAr: "قصة ١٣",
        description: "A picture beside a bold heading, a paragraph and a blue gradient pill button.",
        descriptionAr: "صورة بجانب عنوان عريض وفقرة وزر أزرق متدرج.",
        content: {
          images: [art("13", "about-img.jpg")],
          heading: "We’ve made a life that will change you",
          text: "Your watch tracks your heart rate, sleep and daily activity, and brings notifications and calls straight to your wrist, in an elegant design that suits every look.",
          buttonLabel: "Get Started now",
          buttonHref: "/products",
        },
      },
      {
        type: "xs_features",
        label: "Features 13",
        labelAr: "مميزات ١٣",
        description: "A centred heading and line on a pale ground, then six white boxes with a blue line icon, a title and a sentence each.",
        descriptionAr: "عنوان وسطر في المنتصف على خلفية فاتحة، ثم ستة مربعات بيضاء في كل مربع أيقونة زرقاء وعنوان وجملة.",
        content: {
          heading: "Some Features that Made us Unique",
          text: "For everyone looking for smart tech that keeps up with their life.",
          items: [
            { icon: "support", image: art("13", "ico-1.svg"), title: "Expert Technicians", text: "Certified technicians set up and service your watch." },
            { icon: "bag", image: art("13", "ico-2.svg"), title: "Professional Service", text: "A dedicated team offering fast service and real support before and after you buy." },
            { icon: "truck", image: art("13", "ico-3.svg"), title: "Great Support", text: "Questions about pairing or settings? We answer quickly." },
            { icon: "return", image: art("13", "ico-4.svg"), title: "Technical Skills", text: "Every watch is tested and updated before it ships." },
            { icon: "support", image: art("13", "ico-5.svg"), title: "Highly Recomended", text: "Chosen again and again by customers across Egypt." },
            { icon: "bag", image: art("13", "ico-6.svg"), title: "Positive Reviews", text: "Our customers' reviews speak for our quality." },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 13",
        labelAr: "شبكة منتجات ١٣",
        description: "A centred bold heading over four columns of your products, with a blue gradient button sliding up on hover.",
        descriptionAr: "عنوان عريض في المنتصف فوق أربعة أعمدة من منتجاتك، ويصعد عند المرور زر أزرق متدرج.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Pre Order", heading: "Our Products", limit: 4, showTabs: false, showSearch: false },
      },
      {
        type: "xs_quotes",
        label: "Reviews 13",
        labelAr: "تقييمات ١٣",
        description: "Your customers' words on a white card on a pale ground, one at a time.",
        descriptionAr: "آراء عملائك على كارت أبيض فوق خلفية فاتحة، واحدًا بعد الآخر.",
        content: {
          heading: "What our customers say",
          items: [
            { quote: "A really great watch! The battery lasts me all day, the screen is clear even in the sun, and my order arrived fast and well packed.", name: "Cody Hines", image: art("13", "user.jpg") },
            { quote: "A really great watch! The battery lasts me all day, the screen is clear even in the sun, and my order arrived fast and well packed.", name: "Chad Herrera", image: art("13", "user.jpg") },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 13",
        labelAr: "عنوان صفحة ١٣",
        description: "The page's name in white on a blue gradient.",
        descriptionAr: "اسم الصفحة بالأبيض على تدرج أزرق.",
        content: { heading: "Contact Us", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 13",
        labelAr: "تواصل ١٣",
        description: "A message form with a blue gradient button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر أزرق متدرج بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Send Message",
          contactPlaceholder: "Enter email address",
          messagePlaceholder: "Enter Message",
          buttonLabel: "Send Message",
          info: [
            { icon: "address", title: "Nasr City, Cairo", text: "Open daily from 10 am to 10 pm" },
            { icon: "phone", title: "Call Us", text: "Mon to Fri 9am to 6 pm" },
            { icon: "email", title: "Email Us", text: "Send us your query anytime!" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "14",
    bands: [
      {
        type: "xs_slider",
        label: "Hero 14",
        labelAr: "واجهة ١٤",
        description: "A pale photograph with a large serif heading in red and navy, a sentence and a square red button on its start side.",
        descriptionAr: "صورة فاتحة وفي جانبها عنوان كبير بالأحمر والكحلي وجملة وزر أحمر مربع.",
        content: {
          slides: [
            { image: art("14", "slider-bg.jpg"), eyebrow: "Sale 20% Off", heading: "On Everything", text: "The season's collection is here: elegant shirts and eye-catching dresses in comfortable fabrics and carefully made cuts. 20% off everything for a limited time, so don't miss out.", buttonLabel: "Shop Now", buttonHref: "/products" },
          ],
          autoplay: false,
        },
      },
      {
        type: "xs_features",
        label: "Why us 14",
        labelAr: "مميزات ١٤",
        description: "A centred serif heading over a short red bar, then three navy boxes, each a white icon, a bold title and a line.",
        descriptionAr: "عنوان في المنتصف تحته شرطة حمراء قصيرة، ثم ثلاثة مربعات كحلية في كل مربع أيقونة بيضاء وعنوان عريض وسطر.",
        content: {
          heading: "Why Shop With Us",
          items: [
            { icon: "truck", image: art("14", "ico-1.svg"), title: "Fast Delivery", text: "Your order reaches your door within days." },
            { icon: "bag", image: art("14", "ico-2.svg"), title: "Free Shiping", text: "Free shipping on every order, anywhere in Egypt." },
            { icon: "support", image: art("14", "ico-3.svg"), title: "Best Quality", text: "Chosen fabrics and careful finishing in every piece." },
          ],
        },
      },
      {
        type: "xs_split",
        label: "New arrivals 14",
        labelAr: "وصل حديثًا ١٤",
        description: "A picture filling one half of a mauve-grey ground, with a large navy serif heading, a paragraph and a square red button on the other.",
        descriptionAr: "صورة تملأ نصف خلفية رمادية مائلة للبنفسجي، وفي النصف الآخر عنوان كحلي كبير وفقرة وزر أحمر مربع.",
        content: {
          images: [art("14", "arrival-bg.jpg")],
          heading: "#NewArrivals",
          text: "New pieces join our collection every week, from practical shirts to evening dresses. Discover the latest trends before anyone else and choose what speaks for your style.",
          buttonLabel: "Shop Now",
          buttonHref: "/products",
        },
      },
      {
        type: "xs_products",
        label: "Product grid 14",
        labelAr: "شبكة منتجات ١٤",
        description: "A centred serif heading over a red bar, then three columns of your products on pale cards in a white frame, with a red button under the grid.",
        descriptionAr: "عنوان في المنتصف تحته شرطة حمراء، ثم ثلاثة أعمدة من منتجاتك على كروت فاتحة بإطار أبيض، وتحت الشبكة زر أحمر.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "View All products", viewLabel: "Buy Now", openLabel: "Add To Cart", heading: "Our products", linkLabel: "View All products", linkHref: "/products", limit: 12, showTabs: false, showSearch: false },
      },
      {
        type: "xs_newsletter",
        label: "Subscribe 14",
        labelAr: "اشتراك ١٤",
        description: "A navy serif heading and a line on a mauve-grey ground, over a white pill for the email and a red pill button.",
        descriptionAr: "عنوان كحلي وسطر على خلفية رمادية مائلة للبنفسجي، وتحتهما خانة بريد بيضاء مستديرة وزر أحمر مستدير.",
        content: { heading: "Subscribe To Get Discount Offers", text: "Be the first to hear about new collections and exclusive sales, straight to your inbox.", placeholder: "Enter your email", buttonLabel: "Subscribe" },
      },
      {
        type: "xs_quotes",
        label: "Testimonials 14",
        labelAr: "آراء ١٤",
        description: "Your customers' words one at a time under a round portrait and a name, with round red arrows at the sides.",
        descriptionAr: "آراء عملائك واحدًا بعد الآخر تحت صورة دائرية واسم، وعلى الجانبين أسهم حمراء دائرية.",
        content: {
          heading: "Customer's Testimonial",
          items: [
            { quote: "I ordered a dress for me and a shirt for my husband, and it arrived within two days, beautifully wrapped. The fabric is even nicer than in the photos and the fit is perfect. Definitely not my last order.", name: "Anna Trevor", role: "Customer", image: art("14", "client.jpg") },
            { quote: "I ordered a dress for me and a shirt for my husband, and it arrived within two days, beautifully wrapped. The fabric is even nicer than in the photos and the fit is perfect. Definitely not my last order.", name: "Anna Trevor", role: "Customer", image: art("14", "client.jpg") },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 14",
        labelAr: "عنوان صفحة ١٤",
        description: "The page's name in bold white on a red band.",
        descriptionAr: "اسم الصفحة بخط أبيض عريض على شريط أحمر.",
        content: { heading: "Contact us", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 14",
        labelAr: "تواصل ١٤",
        description: "A plain centred message form with a dark square button, and your address, phone and email in a row under it. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بسيط في المنتصف بزر غامق مربع، وتحته عنوانك وهاتفك وبريدك في صف. الرسائل تصل إلى جهات الاتصال.",
        content: {
          formName: "Contact us",
          contactPlaceholder: "Enter your email address",
          messagePlaceholder: "Enter your message",
          buttonLabel: "Submit",
          info: [
            { icon: "address", title: "Address:", text: "Mohandessin, Giza" },
            { icon: "phone", title: "Telephone:", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Email:", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_title",
        label: "Page title 14",
        labelAr: "عنوان صفحة ١٤",
        description: "The page's name in bold white on a red band.",
        descriptionAr: "اسم الصفحة بخط أبيض عريض على شريط أحمر.",
        content: { heading: "About us", image: "" },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_features",
        label: "Why us 14",
        labelAr: "مميزات ١٤",
        description: "A centred serif heading over a short red bar, then three navy boxes, each a white icon, a bold title and a line.",
        descriptionAr: "عنوان في المنتصف تحته شرطة حمراء قصيرة، ثم ثلاثة مربعات كحلية في كل مربع أيقونة بيضاء وعنوان عريض وسطر.",
        content: {
          heading: "Why Shop With Us",
          items: [
            { icon: "truck", image: art("14", "ico-1.svg"), title: "Fast Delivery", text: "Your order reaches your door within days." },
            { icon: "bag", image: art("14", "ico-2.svg"), title: "Free Shiping", text: "Free shipping on every order, anywhere in Egypt." },
            { icon: "support", image: art("14", "ico-3.svg"), title: "Best Quality", text: "Chosen fabrics and careful finishing in every piece." },
          ],
        },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_split",
        label: "New arrivals 14",
        labelAr: "وصل حديثًا ١٤",
        description: "A picture filling one half of a mauve-grey ground, with a large navy serif heading, a paragraph and a square red button on the other.",
        descriptionAr: "صورة تملأ نصف خلفية رمادية مائلة للبنفسجي، وفي النصف الآخر عنوان كحلي كبير وفقرة وزر أحمر مربع.",
        content: {
          images: [art("14", "arrival-bg.jpg")],
          heading: "#NewArrivals",
          text: "New pieces join our collection every week, from practical shirts to evening dresses. Discover the latest trends before anyone else and choose what speaks for your style.",
          buttonLabel: "Shop Now",
          buttonHref: "/products",
        },
        page: { path: "/about", title: "About" },
        library: false,
      },
    ],
  },
  {
    look: "15",
    bands: [
      {
        type: "xs_banners",
        label: "Collection tiles 15",
        labelAr: "مربعات الأقسام ١٥",
        description: "Three pictures with a red slant across their left side that carries a white title and a link; the picture grows on hover.",
        descriptionAr: "ثلاث صور عليها مائل أحمر من جهة اليسار فوقه عنوان أبيض ورابط، والصورة تكبر عند المرور.",
        content: {
          items: [
            { image: art("15", "shop01.png"), title: "Laptop Collection", linkLabel: "Shop Now", href: "/products" },
            { image: art("15", "shop03.png"), title: "Accessories Collection", linkLabel: "Shop Now", href: "/products" },
            { image: art("15", "shop02.png"), title: "Cameras Collection", linkLabel: "Shop Now", href: "/products" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product row 15",
        labelAr: "صف منتجات ١٥",
        description: "A capital heading with your collections as red-underlined tabs across from it, over one row of framed product cards to slide along; a card takes a red ring and a red pill button on hover.",
        descriptionAr: "عنوان بحروف كبيرة ومقابله أقسامك كتبويبات تحتها خط أحمر، فوق صف واحد من كروت منتجات بإطار يتحرك بالأسهم، والكارت يأخذ إطارًا أحمر وزرًا أحمر عند المرور.",
        content: { loadMoreLabel: "Load More", allLabel: "All Categories", searchLabel: "Search", searchPlaceholder: "Search here", viewLabel: "quick view", openLabel: "add to cart", heading: "New Products", limit: 8, layout: "slider", showSearch: false },
      },
      {
        type: "xs_split",
        label: "Hot deal 15",
        labelAr: "عرض ساخن ١٥",
        description: "A wide grey picture band with a capital heading, a line and a red pill button in its middle, under round red discs that count down to the date you set.",
        descriptionAr: "شريط صورة رمادي عريض في وسطه عنوان بحروف كبيرة وسطر وزر أحمر، تحت دوائر حمراء تعدّ تنازليًا حتى الموعد الذي تحدده.",
        content: {
          images: [art("15", "hotdeal.png")],
          heading: "Hot Deal This Week",
          text: "New Collection Up to 50% OFF",
          endsAt: "",
          countdownLabels: ["Days", "Hours", "Mins", "Secs"],
          buttonLabel: "Shop Now",
          buttonHref: "/products",
        },
      },
      {
        type: "xs_products",
        label: "Top selling row 15",
        labelAr: "صف الأكثر مبيعًا ١٥",
        description: "A second row of your products to slide along, under its own capital heading and tabs.",
        descriptionAr: "صف ثانٍ من منتجاتك يتحرك بالأسهم، تحت عنوانه وتبويباته.",
        content: { loadMoreLabel: "Load More", allLabel: "All Categories", searchLabel: "Search", searchPlaceholder: "Search here", viewLabel: "quick view", openLabel: "add to cart", heading: "Top selling", limit: 8, layout: "slider", showSearch: false },
        library: false,
      },
      {
        type: "xs_minis",
        label: "Small product rows 15",
        labelAr: "صفوف منتجات صغيرة ١٥",
        description: "Your products as small rows in three columns: a little square picture, the name in capitals and a red link.",
        descriptionAr: "منتجاتك في صفوف صغيرة على ثلاثة أعمدة: صورة مربعة صغيرة والاسم بحروف كبيرة ورابط أحمر.",
        content: { limit: 9, linkLabel: "Shop Now" },
      },
      {
        type: "xs_newsletter",
        label: "Newsletter 15",
        labelAr: "نشرة بريدية ١٥",
        description: "A centred line over a rounded email box joined to a red button, between a grey rule and a red one. Addresses arrive in your Contacts, marked as agreeing to hear from you.",
        descriptionAr: "سطر في المنتصف فوق خانة بريد دائرية الأطراف ملتصقة بزر أحمر، بين خط رمادي وخط أحمر. العناوين تصل إلى جهات الاتصال مع موافقة أصحابها على مراسلتك.",
        content: { heading: "Sign Up for the NEWSLETTER", placeholder: "Enter Your Email", buttonLabel: "Subscribe" },
      },
      {
        type: "xs_title",
        label: "Page title 15",
        labelAr: "عنوان صفحة ١٥",
        description: "The page's name in dark capitals at the start of a pale strip.",
        descriptionAr: "اسم الصفحة بحروف كبيرة داكنة في بداية شريط فاتح.",
        content: { heading: "Contact Us", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 15",
        labelAr: "تواصل ١٥",
        description: "A message form with a red pill button beside your address, phone and email. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بزر أحمر دائري الأطراف بجانب عنوانك وهاتفك وبريدك. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Send Us a Message",
          contactPlaceholder: "Email",
          messagePlaceholder: "Your Message",
          buttonLabel: "Send Now",
          info: [
            { icon: "address", title: "Address", text: "Nasr City, Cairo" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "16",
    bands: [
      {
        type: "xs_slider",
        label: "Slider 16",
        labelAr: "سلايدر ١٦",
        description: "Wide pictures with a very large white heading, a sentence and a red pill button low on the picture.",
        descriptionAr: "صور عريضة عليها عنوان أبيض كبير جدًا وجملة وزر أحمر بيضاوي في أسفل الصورة.",
        content: {
          slides: [
            { image: art("16", "slide-1.jpg"), heading: "Women", text: "Experience the best in sportswear with our latest collection.", buttonLabel: "Shop Now", buttonHref: "/products" },
            { image: art("16", "slide-2.png"), heading: "Men", text: "Discover the latest trends in Men`s sportswear and casual fashion.", buttonLabel: "Shop Now", buttonHref: "/products" },
            { image: art("16", "slide-3.jpg"), heading: "Accessories", text: "Elevate your style with our latest sportswear collection.", buttonLabel: "Shop Now", buttonHref: "/products" },
          ],
          seconds: 5,
        },
      },
      {
        type: "xs_banners",
        label: "Category tiles 16",
        labelAr: "بلاطات أقسام ١٦",
        description: "Three rounded pictures under a grey veil, each with a bold white title and a red pill button in its middle.",
        descriptionAr: "ثلاث صور بحواف دائرية فوقها طبقة رمادية، وفي منتصف كل صورة عنوان أبيض عريض وزر أحمر بيضاوي.",
        content: {
          variant: "tile",
          items: [
            { image: art("16", "cat-1.jpg"), title: "Men", linkLabel: "Shop Now", href: "/products" },
            { image: art("16", "cat-2.jpg"), title: "Women", linkLabel: "Shop Now", href: "/products" },
            { image: art("16", "cat-3.jpg"), title: "Accessories", linkLabel: "Shop Now", href: "/products" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product cards 16",
        labelAr: "كروت منتجات ١٦",
        description: "A bold heading over four white cards with a soft shadow: a tall rounded picture, the name, the price (red when marked down) and a full-width red pill button.",
        descriptionAr: "عنوان عريض فوق أربعة كروت بيضاء بظل خفيف: صورة طولية بحواف دائرية واسم المنتج وسعره (بالأحمر لو عليه خصم) وزر أحمر بيضاوي بعرض الكارت.",
        content: { allLabel: "All Products", loadMoreLabel: "Load More", viewLabel: "Quick View", searchLabel: "Search", searchPlaceholder: "Search for products...", openLabel: "Add to Cart", heading: "Popular products", limit: 4, showTabs: false, showSearch: false },
      },
      {
        type: "xs_products",
        label: "Product cards 16",
        labelAr: "كروت منتجات ١٦",
        description: "",
        descriptionAr: "",
        content: { allLabel: "All Products", loadMoreLabel: "Load More", viewLabel: "Quick View", searchLabel: "Search", searchPlaceholder: "Search for products...", openLabel: "Add to Cart", heading: "Latest products", limit: 4, showTabs: false, showSearch: false },
        library: false,
      },
      {
        type: "xs_gallery",
        label: "Brand logos 16",
        labelAr: "شعارات الماركات ١٦",
        description: "A large centred heading and a line over a row of logos, each shown whole on a rounded grey tile.",
        descriptionAr: "عنوان كبير في المنتصف وتحته سطر، ثم صف شعارات كل شعار كامل على مربع رمادي بحواف دائرية.",
        content: {
          variant: "logos",
          heading: "Discover Our Brands",
          text: "Explore the top brands we feature in our store",
          images: [art("16", "brand-html.svg"), art("16", "brand-js.svg"), art("16", "brand-laravel.svg"), art("16", "brand-php.svg"), art("16", "brand-react.svg"), art("16", "brand-tailwind.svg")],
        },
      },
      {
        type: "xs_hero",
        label: "Shop banner 16",
        labelAr: "بانر المتجر ١٦",
        description: "A wide rounded photograph under a dark veil, with a bold white heading and two red pill buttons in its middle.",
        descriptionAr: "صورة عريضة بحواف دائرية فوقها طبقة داكنة، وفي منتصفها عنوان أبيض عريض وزران أحمران بيضاويان.",
        content: { heading: "Welcome to Our Shop", buttonLabel: "Shop Now", buttonHref: "/products", button2Label: "New Arrivals", button2Href: "/products", image: art("16", "banner.jpg") },
      },
      {
        type: "xs_posts",
        label: "Articles 16",
        labelAr: "مقالات ١٦",
        description: "Three white cards with a soft shadow under a large centred heading and line: a tall rounded picture, a small red line in capitals, a title, a sentence and a red pill link. You write each card.",
        descriptionAr: "ثلاث بطاقات بيضاء بظل خفيف تحت عنوان كبير وسطر في المنتصف: صورة طولية بحواف دائرية وسطر أحمر صغير وعنوان وجملة ورابط أحمر بيضاوي. تكتب كل بطاقة بنفسك.",
        content: {
          heading: "Discover Our Blog",
          text: "Stay updated with the latest trends, tips, and stories in the world of fashion",
          items: [
            { image: art("16", "post-1.jpg"), meta: "Fashion Trends", title: "Latest Shirt Trends for 2024", text: "Explore the hottest shirt trends of 2024. From bold prints to classic styles, stay ahead of the fashion curve with our expert insights.", linkLabel: "Read more", href: "" },
            { image: art("16", "post-2.jpg"), meta: "Styling Tips", title: "How to Style Your Shirt for Any Occasion", text: "Learn how to style your shirt for different occasions, whether it's a casual day out or a formal event. Get tips from fashion experts.", linkLabel: "Read more", href: "" },
            { image: art("16", "post-3.jpg"), meta: "Customer Stories", title: "Real Stories from Our Happy Customers", text: "Read about the experiences of our customers. Discover how our shirts have made a difference in their lives and their personal style.", linkLabel: "Read more", href: "" },
          ],
        },
      },
      {
        type: "xs_newsletter",
        label: "Newsletter 16",
        labelAr: "نشرة بريدية ١٦",
        description: "A bold line over a narrow one-line email sign-up: a pill field and a red pill button. Addresses arrive in your Contacts, marked as agreeing to hear from you.",
        descriptionAr: "سطر عريض فوق خانة اشتراك بالبريد بحواف بيضاوية وزر أحمر بيضاوي. العناوين تصل إلى جهات الاتصال مع موافقة أصحابها على مراسلتك.",
        content: { heading: "Join our newsletter and get EGP 250 off your first order", placeholder: "Enter your email address", buttonLabel: "Subscribe" },
      },
      {
        type: "xs_title",
        label: "Page title 16",
        labelAr: "عنوان صفحة ١٦",
        description: "The page's name in dark semi-bold letters on white; given a picture, it turns white and centred under a dark veil.",
        descriptionAr: "اسم الصفحة بحروف داكنة على خلفية بيضاء، ولو أضفت صورة يصبح أبيض في المنتصف فوق طبقة داكنة.",
        content: { heading: "Contact", image: "" },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 16",
        labelAr: "تواصل ١٦",
        description: "A message form with pill-shaped fields and a red pill button in one white shadowed card, and your address, phone and email in the card beside it. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بخانات بيضاوية وزر أحمر بيضاوي في كارت أبيض بظل، وعنوانك وهاتفك وبريدك في الكارت المجاور. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Contact Us",
          contactPlaceholder: "Enter your email address",
          buttonLabel: "Send Now",
          info: [
            { icon: "address", title: "Address", text: "Heliopolis, Cairo" },
            { icon: "phone", title: "Phone", text: "Call us any day from 10 am to 10 pm" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
  {
    look: "17",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 17",
        labelAr: "واجهة ١٧",
        description: "A large bold heading, a paragraph and two square buttons, one orange and one black, on a pale grey ground, with a cut-out picture beside them.",
        descriptionAr: "عنوان عريض كبير وفقرة وزران مربعان، برتقالي وأسود، على خلفية رمادية فاتحة، وبجانبهم صورة مفرّغة.",
        content: {
          heading: "Welcome to Our Fruits Shop",
          text: "We pick our fruit from the best farms and sort it by hand, piece by piece, so it reaches you fresh, juicy and full of flavour, with fast delivery that keeps it at its best.",
          buttonLabel: "Shop Now",
          buttonHref: "/products",
          button2Label: "Contact Us",
          button2Href: "/contact",
          image: art("17", "hero.png"),
        },
      },
      {
        type: "xs_features",
        label: "Services 17",
        labelAr: "خدمات ١٧",
        description: "A centred bold heading and line, then three outlined cards with a small black icon, an orange title and a paragraph each; an orange bar tops the card under the pointer.",
        descriptionAr: "عنوان عريض وسطر في المنتصف، ثم ثلاثة كروت بإطار في كل كارت أيقونة سوداء صغيرة وعنوان برتقالي وفقرة، ويظهر شريط برتقالي أعلى الكارت عند المرور.",
        content: {
          heading: "Our Services",
          text: "Fresh, hand-picked fruit, from the farm to your door every day.",
          items: [
            { icon: "bag", image: art("17", "ico-1.png"), title: "Orange", text: "Sweet, juicy oranges picked at the peak of their season, perfect for fresh juice." },
            { icon: "truck", image: art("17", "ico-2.png"), title: "Grapes", text: "Crisp seedless grapes, washed and packed with care to stay fresh for days." },
            { icon: "support", image: art("17", "ico-3.png"), title: "Gauva", text: "Fragrant guava from Egyptian orchards, rich in flavour and vitamin C." },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product rows 17",
        labelAr: "صفوف منتجات ١٧",
        description: "A centred bold heading over your products one to a row: the name, the price and a black square button on one side, the picture on the other.",
        descriptionAr: "عنوان عريض في المنتصف فوق منتجاتك، كل منتج في صف: الاسم والسعر وزر أسود مربع في جهة، والصورة في الجهة الأخرى.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", openLabel: "Buy Now", heading: "Fresh Fruits", limit: 3, showTabs: false, showSearch: false, quickView: false, viewLabel: "Buy Now" },
      },
      {
        type: "xs_title",
        label: "Page title 17",
        labelAr: "عنوان صفحة ١٧",
        description: "A very large white heading in capitals in the middle of a wide dimmed photograph.",
        descriptionAr: "عنوان أبيض كبير جدًا في منتصف صورة عريضة معتمة.",
        content: { heading: "Very tasty fruits", image: art("17", "tasty.jpg") },
      },
      {
        type: "xs_quotes",
        label: "Quotes 17",
        labelAr: "آراء ١٧",
        description: "A centred bold heading, then your customers' words one at a time: a picture, the name and the words in the middle, with two round dark arrows underneath.",
        descriptionAr: "عنوان عريض في المنتصف، ثم آراء عملائك واحدًا بعد الآخر: صورة ثم الاسم ثم الكلام في المنتصف، وتحتها سهمان دائريان غامقان.",
        content: {
          heading: "Testimonial",
          items: [
            { quote: "I have ordered my fruit from them every week for months, and every time it arrives as fresh as if it was just picked. Sweet oranges, crisp grapes and delivery always on time. They are my first stop for fruit now.", name: "Johnhex", image: art("17", "client.png") },
            { quote: "I have ordered my fruit from them every week for months, and every time it arrives as fresh as if it was just picked. Sweet oranges, crisp grapes and delivery always on time. They are my first stop for fruit now.", name: "Johnhex", image: art("17", "client.png") },
          ],
        },
      },
      {
        type: "xs_contact",
        label: "Contact 17",
        labelAr: "تواصل ١٧",
        description: "A bold heading over a message form of plain underlined fields with a small orange button, and a dish of lemon slices at the edge of the page. Messages arrive in your Contacts.",
        descriptionAr: "عنوان عريض فوق نموذج رسالة بحقول عليها خط سفلي فقط وزر برتقالي صغير، وعلى حافة الصفحة طبق شرائح ليمون. الرسائل تصل إلى جهات الاتصال.",
        content: { heading: "Contact Us", contactPlaceholder: "Email", messagePlaceholder: "Message", buttonLabel: "Send Now" },
      },
      {
        type: "xs_newsletter",
        label: "Newsletter 17",
        labelAr: "نشرة بريدية ١٧",
        description: "A small heading, a narrow email box and an orange square button under it, in the middle of a pale grey band. Addresses arrive in your Contacts.",
        descriptionAr: "عنوان صغير وخانة بريد ضيقة وتحتها زر برتقالي مربع، في منتصف شريط رمادي فاتح. العناوين تصل إلى جهات الاتصال.",
        content: { heading: "Subscribe Now", buttonLabel: "Subscribe" },
      },
      {
        type: "xs_title",
        label: "Page title 17",
        labelAr: "عنوان صفحة ١٧",
        description: "A very large white heading in capitals in the middle of a wide dimmed photograph.",
        descriptionAr: "عنوان أبيض كبير جدًا في منتصف صورة عريضة معتمة.",
        content: { heading: "Contact Us", image: art("17", "tasty.jpg") },
        page: { path: "/contact", title: "Contact" },
        library: false,
      },
      {
        type: "xs_contact",
        label: "Contact 17",
        labelAr: "تواصل ١٧",
        description: "A message form of plain underlined fields with a small orange button, and a dish of lemon slices at the edge of the page. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بحقول عليها خط سفلي فقط وزر برتقالي صغير، وعلى حافة الصفحة طبق شرائح ليمون. الرسائل تصل إلى جهات الاتصال.",
        content: { formName: "Contact Us", contactPlaceholder: "Email", messagePlaceholder: "Message", buttonLabel: "Send Now" },
        page: { path: "/contact", title: "Contact" },
        library: false,
      },
    ],
  },
  {
    look: "21",
    bands: [
      {
        type: "xs_slider",
        label: "Hero 21",
        labelAr: "واجهة ٢١",
        description: "A dark photograph the height of the screen, with a very large script heading, an italic line and a hairline under them in the middle.",
        descriptionAr: "صورة داكنة بارتفاع الشاشة، وفي منتصفها عنوان كبير جدًا بخط يدوي وتحته سطر مائل وخط رفيع.",
        content: {
          slides: [{ image: art("21", "steak.jpg"), heading: "Restaurant", text: '" Best in the city "' }],
        },
      },
      {
        type: "xs_gallery",
        label: "About 21",
        labelAr: "من نحن ٢١",
        description: "A heading in a thin frame, a small knife-and-fork icon and a large justified paragraph on one side, with four pictures two by two on the other.",
        descriptionAr: "عنوان داخل إطار رفيع وأيقونة شوكة وسكين صغيرة وفقرة كبيرة في جهة، وفي الجهة الأخرى أربع صور في صفين.",
        content: {
          heading: "About us",
          text: "Restaurant is a place for simplicity. Good food, good beer, and good service. Simple is the name of the game, and we’re good at finding it in all the right places, even in your dining experience. We’re a small group from Cairo who make simple food possible. Come join us and see what simplicity tastes like.",
          images: [art("21", "kabob.jpg"), art("21", "limes.jpg"), art("21", "radish.jpg"), art("21", "corn.jpg")],
        },
      },
      {
        type: "xs_title",
        label: "Photo banner 21",
        labelAr: "بانر صورة ٢١",
        description: "A tall photograph that holds still while the page scrolls over it, with one large white heading in the middle.",
        descriptionAr: "صورة عالية تظل ثابتة والصفحة تتحرك فوقها، وفي منتصفها عنوان أبيض كبير.",
        content: { heading: "Affordable pricing", image: art("21", "pricing.jpg") },
      },
      {
        type: "xs_products",
        label: "Menu grid 21",
        labelAr: "شبكة المنيو ٢١",
        description: "Your collections as bold tabs in the middle, over small cards of your products: a picture on a red block with the name and a large white price.",
        descriptionAr: "أقسامك كتبويبات عريضة في المنتصف، وتحتها كروت صغيرة لمنتجاتك: صورة فوق مستطيل أحمر عليه الاسم والسعر بالأبيض.",
        content: { searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", limit: 8, showSearch: false, allLabel: "All" },
      },
      {
        type: "xs_title",
        label: "Photo banner 21",
        labelAr: "بانر صورة ٢١",
        description: "A tall photograph that holds still while the page scrolls over it, with one large white heading in the middle.",
        descriptionAr: "صورة عالية تظل ثابتة والصفحة تتحرك فوقها، وفي منتصفها عنوان أبيض كبير.",
        content: { heading: "Great Place to enjoy", image: art("21", "beer.jpg") },
        library: false,
      },
      {
        type: "xs_split",
        label: "Story 21",
        labelAr: "قصة ٢١",
        description: "A picture beside a heading in a thin frame, a small icon and a large justified paragraph. Two pictures stand side by side; three take turns in one frame.",
        descriptionAr: "صورة بجانب عنوان داخل إطار رفيع وأيقونة صغيرة وفقرة كبيرة. الصورتان تقفان متجاورتين، والثلاث تتبادل الظهور في إطار واحد.",
        content: {
          images: [art("21", "beer_spec.jpg")],
          heading: "OUR BEER",
          text: "Here at Restaurant we’re all about the love of beer. New and bold flavors enter our doors every week, and we can’t help but show them off. While we enjoy the classics, we’re always passionate about discovering something new, so stop by and experience our craft at its best.",
        },
      },
      {
        type: "xs_title",
        label: "Photo banner 21",
        labelAr: "بانر صورة ٢١",
        description: "A tall photograph that holds still while the page scrolls over it, with one large white heading in the middle.",
        descriptionAr: "صورة عالية تظل ثابتة والصفحة تتحرك فوقها، وفي منتصفها عنوان أبيض كبير.",
        content: { heading: "Our Breakfast Menu", image: art("21", "breakfast.jpg") },
        library: false,
      },
      {
        type: "xs_split",
        label: "Story 21",
        labelAr: "قصة ٢١",
        description: "A heading in a thin frame, a small icon and a large justified paragraph, with two pictures side by side on the other side.",
        descriptionAr: "عنوان داخل إطار رفيع وأيقونة صغيرة وفقرة كبيرة، وفي الجهة الأخرى صورتان متجاورتان.",
        content: {
          images: [art("21", "bread1.jpg"), art("21", "bread1.jpg")],
          heading: "OUR BREAD",
          text: "We love the smell of fresh baked bread. Each loaf is handmade at the crack of dawn, using only the simplest of ingredients to bring out smells and flavors that beckon the whole block. Stop by anytime and experience simplicity at its finest.",
          flip: true,
        },
        library: false,
      },
      {
        type: "xs_title",
        label: "Photo banner 21",
        labelAr: "بانر صورة ٢١",
        description: "A tall photograph that holds still while the page scrolls over it, with one large white heading in the middle.",
        descriptionAr: "صورة عالية تظل ثابتة والصفحة تتحرك فوقها، وفي منتصفها عنوان أبيض كبير.",
        content: { heading: "Our Featured Dishes Menu", image: art("21", "featured.jpg") },
        library: false,
      },
      {
        type: "xs_split",
        label: "Story 21",
        labelAr: "قصة ٢١",
        description: "A heading in a thin frame, a small icon and a large justified paragraph, with three pictures taking turns in one frame on the other side.",
        descriptionAr: "عنوان داخل إطار رفيع وأيقونة صغيرة وفقرة كبيرة، وفي الجهة الأخرى ثلاث صور تتبادل الظهور في إطار واحد.",
        content: {
          images: [art("21", "slider1.jpg"), art("21", "slider2.jpg"), art("21", "slider3.jpg")],
          heading: "Have a look to our dishes!",
          text: "Each food is handmade at the crack of dawn, using only the simplest of ingredients to bring out smells and flavors that beckon the whole block. Stop by anytime and experience simplicity at its finest.",
          flip: true,
        },
        library: false,
      },
      {
        type: "xs_title",
        label: "Photo banner 21",
        labelAr: "بانر صورة ٢١",
        description: "A tall photograph that holds still while the page scrolls over it, with one large white heading in the middle.",
        descriptionAr: "صورة عالية تظل ثابتة والصفحة تتحرك فوقها، وفي منتصفها عنوان أبيض كبير.",
        content: { heading: "Reserve a Table!", image: art("21", "reservation-seat.jpg") },
        library: false,
      },
      {
        type: "xs_contact",
        label: "Reservation 21",
        labelAr: "حجز ٢١",
        description: "A plain form with a green button beside a ruled list for your opening hours. Requests arrive in your Contacts.",
        descriptionAr: "نموذج بسيط بزر أخضر بجانب قائمة مسطّرة لمواعيد العمل. الطلبات تصل إلى جهات الاتصال.",
        content: {
          heading: "Reservation",
          contactPlaceholder: "Phone or Email",
          messagePlaceholder: "Reservation Date, Guest Number",
          buttonLabel: "Reserve",
          info: [
            { icon: "address", title: "Hours", text: "Monday to Friday: 7:30 AM - 11:30 AM" },
            { icon: "address", title: "", text: "Saturday & Sunday: 8:00 AM - 9:00 AM" },
            { icon: "address", title: "", text: "Monday to Friday: 12:00 PM - 5:00 PM" },
            { icon: "address", title: "", text: "Monday to Saturday: 6:00 PM - 1:00 AM" },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 21",
        labelAr: "عنوان صفحة ٢١",
        description: "The page's name in large white letters over a tall photograph.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة فوق صورة عالية.",
        content: { heading: "Contact", image: art("21", "steak.jpg") },
        page: { path: "/contact", title: "Contact" },
        library: false,
      },
      {
        type: "xs_contact",
        label: "Contact 21",
        labelAr: "تواصل ٢١",
        description: "A plain message form with a green button beside your phone number on a ruled line. Messages arrive in your Contacts.",
        descriptionAr: "نموذج رسالة بسيط بزر أخضر بجانب رقم هاتفك على سطر مسطّر. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Send Message",
          contactPlaceholder: "Email",
          messagePlaceholder: "Message",
          buttonLabel: "Send Message",
          info: [{ icon: "phone", title: "Or Call Us", text: "Any day during our opening hours" }],
        },
        page: { path: "/contact", title: "Contact" },
        library: false,
      },
      {
        type: "xs_title",
        label: "Page title 21",
        labelAr: "عنوان صفحة ٢١",
        description: "The page's name in large white letters over a tall photograph.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة فوق صورة عالية.",
        content: { heading: "Affordable pricing", image: art("21", "pricing.jpg") },
        page: { path: "/menu", title: "Menu" },
        library: false,
      },
      {
        type: "xs_products",
        label: "Menu grid 21",
        labelAr: "شبكة المنيو ٢١",
        description: "Your collections as bold tabs in the middle, over small cards of your products: a picture on a red block with the name and a large white price.",
        descriptionAr: "أقسامك كتبويبات عريضة في المنتصف، وتحتها كروت صغيرة لمنتجاتك: صورة فوق مستطيل أحمر عليه الاسم والسعر بالأبيض.",
        content: { searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", limit: 12, showSearch: false, allLabel: "All" },
        page: { path: "/menu", title: "Menu" },
        library: false,
      },
    ],
  },
  {
    look: "18",
    bands: [
      {
        type: "xs_slider",
        label: "Slider 18",
        labelAr: "سلايدر ١٨",
        description: "A dark photograph to the foot of the screen under a clear bar, with a large white script heading, a small paragraph and a yellow pill button on its start side, and two round yellow arrows beneath.",
        descriptionAr: "صورة داكنة بارتفاع الشاشة وشريط القائمة شفاف فوقها، وفي جانبها عنوان أبيض كبير بخط يدوي وفقرة صغيرة وزر أصفر دائري، وتحتهم سهمان أصفران دائريان.",
        content: {
          slides: [
            { image: art("18", "hero-bg.jpg"), heading: "Fast Food Restaurant", text: "Juicy burgers, hot pizza from the oven and crispy fries, freshly made for you in minutes. Order now and enjoy your meal hot wherever you are.", buttonLabel: "Order Now", buttonHref: "/menu" },
            { image: art("18", "hero-bg.jpg"), heading: "Fast Food Restaurant", text: "Juicy burgers, hot pizza from the oven and crispy fries, freshly made for you in minutes. Order now and enjoy your meal hot wherever you are.", buttonLabel: "Order Now", buttonHref: "/menu" },
            { image: art("18", "hero-bg.jpg"), heading: "Fast Food Restaurant", text: "Juicy burgers, hot pizza from the oven and crispy fries, freshly made for you in minutes. Order now and enjoy your meal hot wherever you are.", buttonLabel: "Order Now", buttonHref: "/menu" },
          ],
        },
      },
      {
        type: "xs_banners",
        label: "Offers 18",
        labelAr: "عروض ١٨",
        description: "Two dark cards side by side, each a round picture in a yellow ring beside a script title, a large discount line and a yellow pill link.",
        descriptionAr: "كارتان داكنان متجاوران، في كل كارت صورة دائرية بإطار أصفر وبجانبها عنوان بخط يدوي وسطر خصم كبير وزر أصفر دائري.",
        content: {
          items: [
            { image: art("18", "o1.jpg"), title: "Tasty Thursdays", text: "20% Off", linkLabel: "Order Now", href: "/menu" },
            { image: art("18", "o2.jpg"), title: "Pizza Days", text: "15% Off", linkLabel: "Order Now", href: "/menu" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Menu 18",
        labelAr: "قائمة الطعام ١٨",
        description: "A centred script heading and your collections as rounded pills, over three columns of dark rounded cards: each dish on a pale top, its name and price beneath and a round yellow button beside the price.",
        descriptionAr: "عنوان بخط يدوي في المنتصف وأقسامك كأزرار دائرية، فوق ثلاثة أعمدة من كروت داكنة بحواف دائرية: صورة الطبق على خلفية فاتحة، وتحتها الاسم والسعر وبجانب السعر زر أصفر دائري.",
        content: { searchLabel: "Search", searchPlaceholder: "Search", viewLabel: "Quick View", openLabel: "Add to cart", allLabel: "All", loadMoreLabel: "View More", heading: "Our Menu", limit: 9, showSearch: false },
      },
      {
        type: "xs_split",
        label: "About 18",
        labelAr: "من نحن ١٨",
        description: "A cut-out picture beside a white script heading, a paragraph and a yellow pill button, on a dark slate ground.",
        descriptionAr: "صورة مفرّغة بجانب عنوان أبيض بخط يدوي وفقرة وزر أصفر دائري، على خلفية رمادية داكنة.",
        content: { images: [art("18", "about-img.png")], heading: "We Are Feane", text: "At Feane we believe fast food deserves real care. We choose fresh meat every day, bake our pizza dough in our own kitchen and make our sauces from our own recipes. You will taste the difference from the first bite, whether you join us at the restaurant or order delivery to your door.", buttonLabel: "Read More", buttonHref: "/about" },
      },
      {
        type: "xs_contact",
        label: "Book a table 18",
        labelAr: "حجز طاولة ١٨",
        description: "A script heading over boxed fields and a yellow pill button, beside a dark rounded panel with your opening hours, phone and email. Bookings arrive in your Contacts.",
        descriptionAr: "عنوان بخط يدوي فوق خانات بإطار وزر أصفر دائري، وبجانبها لوحة داكنة بحواف دائرية فيها مواعيد العمل وهاتفك وبريدك. الحجوزات تصل إلى جهات الاتصال.",
        content: {
          heading: "Book A Table",
          contactPlaceholder: "Phone Number",
          messagePlaceholder: "How many persons?",
          buttonLabel: "Book Now",
          info: [
            { icon: "address", title: "Opening Hours", text: "Everyday 10.00 Am -10.00 Pm" },
            { icon: "phone", title: "Call", text: "Call us during opening hours" },
            { icon: "email", title: "Contact Us", text: "Send us a message and we reply within a day" },
          ],
        },
      },
      {
        type: "xs_quotes",
        label: "Quotes 18",
        labelAr: "آراء ١٨",
        description: "A centred script heading over your customers' words on a dark card, one at a time, with the customer's picture in a yellow ring hanging under the card and two round yellow arrows.",
        descriptionAr: "عنوان بخط يدوي في المنتصف وتحته آراء عملائك على كارت داكن، واحدًا بعد الآخر، وأسفل الكارت صورة العميل بإطار أصفر وسهمان أصفران دائريان.",
        content: {
          heading: "What Says Our Customers",
          items: [
            { quote: "The burgers are juicy, the pizza dough is light and crispy, and our order arrived hot and early. Feane is now our first choice for weekend nights.", name: "Moana Michell", role: "Regular customer", image: art("18", "client1.jpg") },
            { quote: "The burgers are juicy, the pizza dough is light and crispy, and our order arrived hot and early. Feane is now our first choice for weekend nights.", name: "Mike Hamell", role: "Regular customer", image: art("18", "client2.jpg") },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 18",
        labelAr: "عنوان صفحة ١٨",
        description: "The page's name in a large white script face on the dark top of the photograph, under a clear bar.",
        descriptionAr: "اسم الصفحة بخط يدوي أبيض كبير فوق الجزء الداكن من الصورة، وشريط القائمة شفاف فوقه.",
        content: { heading: "Menu", image: art("18", "hero-bg.jpg") },
        page: { path: "/menu", title: "Menu" },
      },
      {
        type: "xs_products",
        label: "Menu 18",
        labelAr: "قائمة الطعام ١٨",
        description: "",
        descriptionAr: "",
        content: { searchLabel: "Search", searchPlaceholder: "Search", viewLabel: "Quick View", openLabel: "Add to cart", allLabel: "All", loadMoreLabel: "View More", heading: "Our Menu", limit: 9, showSearch: false },
        page: { path: "/menu", title: "Menu" },
        library: false,
      },
      {
        type: "xs_title",
        label: "Page title 18",
        labelAr: "عنوان صفحة ١٨",
        description: "",
        descriptionAr: "",
        content: { heading: "About", image: art("18", "hero-bg.jpg") },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_story",
        label: "Story 18",
        labelAr: "قصة ١٨",
        description: "A cut-out picture beside a white script title and a paragraph, on a dark slate ground; the sides swap from one part to the next.",
        descriptionAr: "صورة مفرّغة بجانب عنوان أبيض بخط يدوي وفقرة، على خلفية رمادية داكنة، ويتبادلان الجهة من جزء لآخر.",
        content: {
          items: [{ title: "We Are Feane", body: "At Feane we believe fast food deserves real care. We choose fresh meat every day, bake our pizza dough in our own kitchen and make our sauces from our own recipes. You will taste the difference from the first bite, whether you join us at the restaurant or order delivery to your door.", image: art("18", "about-img.png") }],
        },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_title",
        label: "Page title 18",
        labelAr: "عنوان صفحة ١٨",
        description: "",
        descriptionAr: "",
        content: { heading: "Book Table", image: art("18", "hero-bg.jpg") },
        page: { path: "/contact", title: "Book Table" },
        library: false,
      },
      {
        type: "xs_contact",
        label: "Book a table 18",
        labelAr: "حجز طاولة ١٨",
        description: "",
        descriptionAr: "",
        content: {
          heading: "Book A Table",
          contactPlaceholder: "Phone Number",
          messagePlaceholder: "How many persons?",
          buttonLabel: "Book Now",
          info: [
            { icon: "address", title: "Opening Hours", text: "Everyday 10.00 Am -10.00 Pm" },
            { icon: "phone", title: "Call", text: "Call us during opening hours" },
            { icon: "email", title: "Contact Us", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Book Table" },
        library: false,
      },
    ],
  },
  {
    look: "20",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 20",
        labelAr: "واجهة ٢٠",
        description: "A very large white heading, a paragraph and a square amber button on a darkened photograph, with a round plate turning slowly beside them.",
        descriptionAr: "عنوان أبيض كبير جدًا وفقرة وزر كهرماني مربع فوق صورة داكنة، وبجانبهم طبق دائري يدور ببطء.",
        content: { heading: "Enjoy Our Delicious Meal", text: "Fresh dishes made by our master chefs with carefully chosen ingredients, in a warm setting made for family and friends.", buttonLabel: "Book A Table", buttonHref: "/contact", image: art("20", "hero.png") },
      },
      {
        type: "xs_features",
        label: "Services 20",
        labelAr: "خدمات ٢٠",
        description: "Four shadowed boxes side by side, each an amber line icon, a bold title and a sentence; a box fills with amber under the pointer.",
        descriptionAr: "أربعة مربعات بظل خفيف متجاورة، في كل مربع أيقونة كهرمانية وعنوان عريض وجملة، ويمتلئ المربع بالكهرماني عند المرور.",
        content: {
          items: [
            { icon: "support", title: "Master Chefs", text: "Experienced chefs who put their passion into every plate." },
            { icon: "bag", title: "Quality Food", text: "Fresh ingredients chosen every morning for real flavour." },
            { icon: "truck", title: "Online Order", text: "Order online and enjoy your meal hot at home." },
            { icon: "return", title: "24/7 Service", text: "We care about every detail to give you a meal worth repeating." },
          ],
        },
      },
      {
        type: "xs_split",
        label: "About 20",
        labelAr: "من نحن ٢٠",
        description: "Three staggered square pictures beside a bold heading, two paragraphs, two figures behind thick amber rules and a square amber button.",
        descriptionAr: "ثلاث صور مربعة متدرجة بجانب عنوان عريض وفقرتين ورقمين خلف خطين كهرمانيين سميكين وزر كهرماني مربع.",
        content: {
          images: [art("20", "about-1.jpg"), art("20", "about-2.jpg"), art("20", "about-3.jpg")],
          heading: "Welcome to Restoran",
          text: "For more than fifteen years we have served our guests food that brings authentic flavour and a modern kitchen together, with fresh ingredients chosen every morning.\n\nOur team of professional chefs puts its passion into every dish, so you enjoy a well-made meal and friendly service whether you visit us or order online.",
          points: ["15 Years of Experience", "50 Popular Master Chefs"],
          buttonLabel: "Read More",
          buttonHref: "/about",
        },
      },
      {
        type: "xs_products",
        label: "Food menu 20",
        labelAr: "قائمة الطعام ٢٠",
        description: "A script line and a bold centred heading, your collections as tabs on a rule, and your dishes as rows in two columns: a small picture, the name and an amber price.",
        descriptionAr: "سطر بخط يدوي وعنوان عريض في المنتصف، وأقسامك كتبويبات فوق خط، وأطباقك صفوفًا في عمودين: صورة صغيرة والاسم وسعر كهرماني.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", heading: "Most Popular Items", linkLabel: "Food Menu", linkHref: "/menu", limit: 8, showSearch: false },
      },
      {
        type: "xs_video",
        label: "Video 20",
        labelAr: "فيديو ٢٠",
        description: "A film on a navy ground that joins the reservation block under it. Paste a YouTube or Vimeo link, or the address of a video file.",
        descriptionAr: "فيديو على خلفية كحلية تتصل بقسم الحجز تحتها. الصق رابط يوتيوب أو فيميو، أو رابط ملف فيديو.",
        content: { heading: "", url: "" },
      },
      {
        type: "xs_contact",
        label: "Reservation 20",
        labelAr: "حجز ٢٠",
        description: "A navy band: a bold white heading over white boxes and a wide amber button, beside your details under script titles. Requests arrive in your Contacts.",
        descriptionAr: "شريط كحلي: عنوان أبيض عريض فوق خانات بيضاء وزر كهرماني عريض، وبجانبه بياناتك تحت عناوين بخط يدوي. الطلبات تصل إلى جهات الاتصال.",
        content: {
          heading: "Book A Table Online",
          contactPlaceholder: "Your Email",
          messagePlaceholder: "Special Request",
          buttonLabel: "Book Now",
          info: [
            { icon: "phone", title: "Reservation", text: "Call us any day to book your table" },
            { icon: "email", title: "Booking", text: "Fill in the form and we will confirm your table" },
            { icon: "address", title: "Contact", text: "Mohandessin, Giza" },
          ],
        },
      },
      {
        type: "xs_team",
        label: "Chefs 20",
        labelAr: "الطهاة ٢٠",
        description: "A script line and a bold centred heading over four shadowed cards, each a round portrait, a name and a role.",
        descriptionAr: "سطر بخط يدوي وعنوان عريض في المنتصف فوق أربعة كروت بظل خفيف، في كل كارت صورة دائرية واسم ووظيفة.",
        content: {
          heading: "Our Master Chefs",
          text: "Team Members",
          items: [
            { image: art("20", "team-1.jpg"), name: "Youssef Adel", role: "Sous Chef" },
            { image: art("20", "team-2.jpg"), name: "Karim Mansour", role: "Executive Chef" },
            { image: art("20", "team-3.jpg"), name: "Omar Fathy", role: "Head Chef" },
            { image: art("20", "team-4.jpg"), name: "Tarek Nabil", role: "Grill Chef" },
          ],
        },
      },
      {
        type: "xs_quotes",
        label: "Quotes 20",
        labelAr: "آراء ٢٠",
        description: "Your customers' words on an amber card, one at a time, with the customer's round picture, name and line beneath and ringed dots under the card.",
        descriptionAr: "آراء عملائك على كارت كهرماني، واحدًا بعد الآخر، وتحتها صورة العميل الدائرية واسمه وسطر عنه، ونقاط دائرية أسفل الكارت.",
        content: {
          heading: "Our Clients Say!!!",
          items: [
            { quote: "Fresh food that tastes like home cooking, with quick and friendly service. It has become our favourite place every week.", name: "Sara Mahmoud", role: "Architect", image: art("20", "testimonial-1.jpg") },
            { quote: "Fresh food that tastes like home cooking, with quick and friendly service. It has become our favourite place every week.", name: "Ahmed Samir", role: "Engineer", image: art("20", "testimonial-2.jpg") },
            { quote: "Fresh food that tastes like home cooking, with quick and friendly service. It has become our favourite place every week.", name: "Mostafa Kamal", role: "Photographer", image: art("20", "testimonial-3.jpg") },
            { quote: "Fresh food that tastes like home cooking, with quick and friendly service. It has become our favourite place every week.", name: "Nour Hany", role: "Teacher", image: art("20", "testimonial-4.jpg") },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 20",
        labelAr: "عنوان صفحة ٢٠",
        description: "The page's name in very large white letters on a darkened photograph.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة جدًا فوق صورة داكنة.",
        content: { heading: "About Us", image: art("20", "bg-hero.jpg") },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_split",
        label: "About 20",
        labelAr: "من نحن ٢٠",
        description: "Three staggered square pictures beside a bold heading, two paragraphs and two figures behind thick amber rules.",
        descriptionAr: "ثلاث صور مربعة متدرجة بجانب عنوان عريض وفقرتين ورقمين خلف خطين كهرمانيين سميكين.",
        content: {
          images: [art("20", "about-1.jpg"), art("20", "about-2.jpg"), art("20", "about-3.jpg")],
          heading: "Welcome to Restoran",
          text: "For more than fifteen years we have served our guests food that brings authentic flavour and a modern kitchen together, with fresh ingredients chosen every morning.\n\nOur team of professional chefs puts its passion into every dish, so you enjoy a well-made meal and friendly service whether you visit us or order online.",
          points: ["15 Years of Experience", "50 Popular Master Chefs"],
        },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_team",
        label: "Chefs 20",
        labelAr: "الطهاة ٢٠",
        description: "A script line and a bold centred heading over four shadowed cards, each a round portrait, a name and a role.",
        descriptionAr: "سطر بخط يدوي وعنوان عريض في المنتصف فوق أربعة كروت بظل خفيف، في كل كارت صورة دائرية واسم ووظيفة.",
        content: {
          heading: "Our Master Chefs",
          text: "Team Members",
          items: [
            { image: art("20", "team-1.jpg"), name: "Youssef Adel", role: "Sous Chef" },
            { image: art("20", "team-2.jpg"), name: "Karim Mansour", role: "Executive Chef" },
            { image: art("20", "team-3.jpg"), name: "Omar Fathy", role: "Head Chef" },
            { image: art("20", "team-4.jpg"), name: "Tarek Nabil", role: "Grill Chef" },
          ],
        },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_title",
        label: "Page title 20",
        labelAr: "عنوان صفحة ٢٠",
        description: "The page's name in very large white letters on a darkened photograph.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة جدًا فوق صورة داكنة.",
        content: { heading: "Food Menu", image: art("20", "bg-hero.jpg") },
        page: { path: "/menu", title: "Menu" },
        library: false,
      },
      {
        type: "xs_products",
        label: "Food menu 20",
        labelAr: "قائمة الطعام ٢٠",
        description: "A script line and a bold centred heading, your collections as tabs on a rule, and your dishes as rows in two columns.",
        descriptionAr: "سطر بخط يدوي وعنوان عريض في المنتصف، وأقسامك كتبويبات فوق خط، وأطباقك صفوفًا في عمودين.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", heading: "Most Popular Items", linkLabel: "Food Menu", linkHref: "/products", limit: 16, showSearch: false },
        page: { path: "/menu", title: "Menu" },
        library: false,
      },
      {
        type: "xs_title",
        label: "Page title 20",
        labelAr: "عنوان صفحة ٢٠",
        description: "The page's name in very large white letters on a darkened photograph.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة جدًا فوق صورة داكنة.",
        content: { heading: "Contact Us", image: art("20", "bg-hero.jpg") },
        page: { path: "/contact", title: "Contact" },
        library: false,
      },
      {
        type: "xs_contact",
        label: "Contact 20",
        labelAr: "تواصل ٢٠",
        description: "A navy band: a message form with a wide amber button, beside your booking, general and technical addresses under script titles. Messages arrive in your Contacts.",
        descriptionAr: "شريط كحلي: نموذج رسالة بزر كهرماني عريض، وبجانبه عناوين الحجز والاستفسارات والدعم تحت عناوين بخط يدوي. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Contact For Any Query",
          contactPlaceholder: "Your Email",
          messagePlaceholder: "Leave a message here",
          buttonLabel: "Send Message",
          info: [
            { icon: "email", title: "Booking", text: "Fill in the form and we will confirm your table" },
            { icon: "email", title: "General", text: "Questions and feedback through the form" },
            { icon: "email", title: "Technical", text: "Help with online orders through the form" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
        library: false,
      },
    ],
  },
  {
    look: "19",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 19",
        labelAr: "واجهة ١٩",
        description: "A photograph as tall as the screen under a dark veil, with a very large white heading and an italic line in its middle; the header lies clear over it.",
        descriptionAr: "صورة بارتفاع الشاشة عليها ظل غامق، وفي وسطها عنوان أبيض كبير جدًا وسطر مائل، والهيدر شفاف فوقها.",
        content: { heading: "The Best Coffee & Restaurant in the Heart of Cairo", text: "An authentic taste that brings you together at one table", image: art("19", "hero.jpg") },
      },
      {
        type: "xs_split",
        label: "The restaurant 19",
        labelAr: "المطعم ١٩",
        description: "A photograph that runs off the edge of the page, beside a script heading, the story and a red-outlined button, on the dark ground.",
        descriptionAr: "صورة تخرج من حافة الصفحة، وبجانبها عنوان بخط يدوي وفقرات وزر بإطار أحمر، على الخلفية الغامقة.",
        content: { images: [art("19", "hero.jpg")], heading: "The Restaurant", text: "Our story began with a cup of coffee and a simple idea: a warm place where every guest enjoys fresh, well-made food. We choose our ingredients every day from the best suppliers and cook every dish as if we were serving our own family.\n\nWhether you come for a quiet breakfast or dinner with family and friends, you will find friendly service and an atmosphere that brings you back again and again.", buttonLabel: "Our History", buttonHref: "/about" },
      },
      {
        type: "xs_products",
        label: "Menu 19",
        labelAr: "قائمة الطعام ١٩",
        description: "A script heading, then your dishes in four columns where every other card hangs lower: a picture, a white name and a yellow price each.",
        descriptionAr: "عنوان بخط يدوي، ثم أطباقك في أربعة أعمدة تنزل فيها البطاقات بالتبادل: صورة واسم أبيض وسعر أصفر لكل طبق.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Learn More", heading: "Today's Menu", limit: 4, showTabs: false, showSearch: false, linkLabel: "See Our Menu", linkHref: "/menu" },
      },
      {
        type: "xs_quotes",
        label: "Quotes 19",
        labelAr: "آراء ١٩",
        description: "A large photograph of your customer with their words in a tall white italic laid over its edge, and their name beneath.",
        descriptionAr: "صورة كبيرة لعميلك وكلامه بخط أبيض مائل كبير فوق حافتها، واسمه تحته.",
        content: {
          heading: "Testimony",
          items: [
            { quote: "From the first sip of coffee to the last bite, every detail here is made with care. Fresh dishes, quick service and a warm atmosphere made this our favourite spot every week.", name: "Jane Smith", image: art("19", "person.jpg") },
          ],
        },
      },
      {
        type: "xs_showcase",
        label: "Best dishes 19",
        labelAr: "أفضل الأطباق ١٩",
        description: "A script heading, a line and a red-outlined button on the start side, beside your dishes as pictures: one large and the rest small, each named in white with a yellow price.",
        descriptionAr: "عنوان بخط يدوي وسطر وزر بإطار أحمر في البداية، وبجانبهم أطباقك كصور: واحدة كبيرة والباقي صغيرة، وعلى كل صورة الاسم بالأبيض والسعر بالأصفر.",
        content: {
          heading: "Our Best & Unique Menu",
          text: "A selection of our tastiest dishes, made daily with fresh ingredients and an unforgettable chef's touch.",
          buttonLabel: "Learn More",
          buttonHref: "/menu",
          limit: 3,
        },
      },
      {
        type: "xs_posts",
        label: "Events 19",
        labelAr: "فعاليات ١٩",
        description: "A centred script heading and a paragraph, then three cards: a picture over a faintly lit panel with a date, a white title, a sentence and a red link. You write each card.",
        descriptionAr: "عنوان بخط يدوي وفقرة في المنتصف، ثم ثلاث بطاقات: صورة فوق لوحة خافتة فيها تاريخ وعنوان أبيض وجملة ورابط أحمر. تكتب كل بطاقة بنفسك.",
        content: {
          heading: "Events",
          text: "Special evenings, tasting nights and themed days where we celebrate good food and good company. Follow our upcoming events and book your place early.",
          items: [
            { image: art("19", "gallery-1.jpg"), meta: "Feb. 15th 2016", title: "Photoshoot On The Street", text: "A special moment in our food journey, shared with guests who became part of our story.", linkLabel: "Read More", href: "" },
            { image: art("19", "gallery-2.jpg"), meta: "Feb. 15th 2016", title: "Surfing at Philippines", text: "A special moment in our food journey, shared with guests who became part of our story.", linkLabel: "Read More", href: "" },
            { image: art("19", "gallery-3.jpg"), meta: "Feb. 15th 2016", title: "Focus On Uderwater", text: "A special moment in our food journey, shared with guests who became part of our story.", linkLabel: "Read More", href: "" },
          ],
        },
      },
      {
        type: "xs_slider",
        label: "Book a table 19",
        labelAr: "احجز طاولة ١٩",
        description: "A wide photograph under a deep dark veil with a script heading, a line and a red-outlined button in its middle; the band is as tall as its words.",
        descriptionAr: "صورة عريضة عليها ظل غامق، وفي وسطها عنوان بخط يدوي وسطر وزر بإطار أحمر، وارتفاعها على قد الكلام.",
        content: {
          autoplay: false,
          slides: [
            {
              image: art("19", "hero.jpg"),
              heading: "Book a Table",
              text: "A family gathering, a romantic dinner or a celebration with friends? Book your table now and leave the rest to us.",
              buttonLabel: "Book Now",
              buttonHref: "/contact",
            },
          ],
        },
      },
      {
        type: "xs_title",
        label: "Page title 19",
        labelAr: "عنوان صفحة ١٩",
        description: "The page's name in very large white letters over a dimmed photograph as tall as the screen; the header lies clear over it.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة جدًا فوق صورة معتمة بارتفاع الشاشة، والهيدر شفاف فوقها.",
        content: { heading: "Get in Touch", image: art("19", "hero.jpg") },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_contact",
        label: "Contact 19",
        labelAr: "تواصل ١٩",
        description: "Your address, phone and email on the start side and a message form in a faint frame on the other, with a red-outlined button. Messages and table requests arrive in your Contacts.",
        descriptionAr: "عنوانك وهاتفك وبريدك في البداية، ونموذج رسالة داخل إطار خافت في الجهة الأخرى بزر بإطار أحمر. الرسائل وطلبات الحجز تصل إلى جهات الاتصال.",
        content: {
          heading: "Don't be shy, let's chat.",
          contactPlaceholder: "Your Email",
          messagePlaceholder: "Your Message",
          buttonLabel: "Submit Form",
          info: [
            { icon: "address", title: "Address", text: "Fifth Settlement, New Cairo" },
            { icon: "phone", title: "Phone", text: "Call us any day to book your table" },
            { icon: "email", title: "Email", text: "Send us a message and we reply within a day" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
      {
        type: "xs_title",
        label: "Page title 19",
        labelAr: "عنوان صفحة ١٩",
        description: "The page's name in very large white letters over a dimmed photograph as tall as the screen; the header lies clear over it.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة جدًا فوق صورة معتمة بارتفاع الشاشة، والهيدر شفاف فوقها.",
        content: { heading: "About our Restaurant", image: art("19", "hero.jpg") },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_split",
        label: "The restaurant 19",
        labelAr: "المطعم ١٩",
        description: "A photograph that runs off the edge of the page, beside a script heading, the story and a red-outlined button, on the dark ground.",
        descriptionAr: "صورة تخرج من حافة الصفحة، وبجانبها عنوان بخط يدوي وفقرات وزر بإطار أحمر، على الخلفية الغامقة.",
        content: { images: [art("19", "hero.jpg")], heading: "The Restaurant", text: "Our story began with a cup of coffee and a simple idea: a warm place where every guest enjoys fresh, well-made food. We choose our ingredients every day from the best suppliers and cook every dish as if we were serving our own family.\n\nWhether you come for a quiet breakfast or dinner with family and friends, you will find friendly service and an atmosphere that brings you back again and again." },
        page: { path: "/about", title: "About" },
        library: false,
      },
      {
        type: "xs_story",
        label: "Timeline 19",
        labelAr: "خط زمني ١٩",
        description: "A timeline: a line down the middle of the page with a red mark for each part, and the words to one side of it and then the other.",
        descriptionAr: "خط زمني: خط في منتصف الصفحة وعليه علامة حمراء لكل جزء، والكلام مرة في جهة ومرة في الجهة الأخرى.",
        content: {
          items: [
            { title: "The Founders Meet", body: "A special moment in our food journey, shared with guests who became part of our story." },
            { title: "Create A Restaurant", body: "We started with a small kitchen and a big passion, and grew with your trust into a home for anyone looking for authentic flavour." },
            { title: "Added 200+ Employees", body: "A special moment in our food journey, shared with guests who became part of our story." },
            { title: "Our First Branch Outside Egypt", body: "We started with a small kitchen and a big passion, and grew with your trust into a home for anyone looking for authentic flavour." },
            { title: "Franchise Restaurants Launched", body: "A special moment in our food journey, shared with guests who became part of our story." },
            { title: "Added 100K More Employees", body: "We started with a small kitchen and a big passion, and grew with your trust into a home for anyone looking for authentic flavour." },
          ],
        },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_gallery",
        label: "Photo wall 19",
        labelAr: "حائط صور ١٩",
        description: "A script heading and a paragraph, then a wall of photographs: in every five, one large picture among four small ones.",
        descriptionAr: "عنوان بخط يدوي وفقرة، ثم حائط صور: في كل خمس صور واحدة كبيرة بين أربع صغيرة.",
        content: {
          heading: "Our Gallery",
          text: "Shots from our kitchen, our dining room and our favourite dishes, and sweet moments with our guests. Take a look, then come and live them yourself.",
          images: [
            art("19", "gallery-1.jpg"), art("19", "gallery-2.jpg"), art("19", "gallery-8.jpg"), art("19", "gallery-4.jpg"), art("19", "gallery-5.jpg"),
            art("19", "gallery-5.jpg"), art("19", "gallery-6.jpg"), art("19", "gallery-7.jpg"), art("19", "gallery-8.jpg"), art("19", "gallery-9.jpg"),
          ],
        },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_title",
        label: "Page title 19",
        labelAr: "عنوان صفحة ١٩",
        description: "The page's name in very large white letters over a dimmed photograph as tall as the screen; the header lies clear over it.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة جدًا فوق صورة معتمة بارتفاع الشاشة، والهيدر شفاف فوقها.",
        content: { heading: "See Our Menu", image: art("19", "hero.jpg") },
        page: { path: "/menu", title: "Menu" },
        library: false,
      },
      {
        type: "xs_products",
        label: "Menu 19",
        labelAr: "قائمة الطعام ١٩",
        description: "A script heading, then your dishes in four columns where every other card hangs lower: a picture, a white name and a yellow price each.",
        descriptionAr: "عنوان بخط يدوي، ثم أطباقك في أربعة أعمدة تنزل فيها البطاقات بالتبادل: صورة واسم أبيض وسعر أصفر لكل طبق.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Learn More", heading: "Our Delicous Menu", limit: 8, showSearch: false },
        page: { path: "/menu", title: "Menu" },
        library: false,
      },
    ],
  },
  {
    look: "22",
    bands: [
      {
        type: "xs_hero",
        label: "Hero 22",
        labelAr: "واجهة ٢٢",
        description: "Centred white words under a violet glow on near-black: a very large heading, a line, a gradient pill button and an outlined one, with a wide rounded picture below.",
        descriptionAr: "كلام أبيض في المنتصف تحت وهج بنفسجي على خلفية شبه سوداء: عنوان كبير جدًا وسطر وزر كبسولة بتدرّج لوني وآخر بإطار، وتحتهم صورة عريضة بحواف دائرية.",
        content: {
          heading: "The All-In-One Growth Software for Local Business Owners",
          text: "The complete automated system designed to capture more leads, follow up instantly, and grow your local business - all in one place.",
          buttonLabel: "Start Your 14-day Free Trial",
          buttonHref: "/products",
          button2Label: "Book a Demo",
          button2Href: "/contact",
          image: art("22", "dashboard.png"),
        },
      },
      {
        type: "xs_features",
        label: "Feature cards 22",
        labelAr: "كروت مميزات ٢٢",
        description: "A centred heading and line, then four soft dark cards, each a white icon, a bold title and a short list with every point on a line of its own.",
        descriptionAr: "عنوان وسطر في المنتصف، ثم أربعة كروت داكنة ناعمة، في كل كارت أيقونة بيضاء وعنوان عريض وقائمة قصيرة كل بند فيها في سطر.",
        content: {
          heading: "Replace Your Clunky Tools With A Smart, All-In-One System",
          text: "Log in to a single powerful dashboard to manage everything seamlessly.",
          items: [
            { icon: "support", image: art("22", "ico-1.svg"), title: "Automated Customer Follow-Up", text: "Missed Call Auto-Responder\n24/7 Appointment Scheduler\nInstant SMS & Email Follow-Up" },
            { icon: "bag", image: art("22", "ico-2.svg"), title: "Smart Customer Database", text: "Unified Lead Inbox\nSmart Pipeline Manager\nClient Notes & History" },
            { icon: "return", image: art("22", "ico-3.svg"), title: "Autopilot Review Generator", text: "Automated Review Requests\nGoogle & Facebook Integration\nReputation Tracking" },
            { icon: "truck", image: art("22", "ico-4.svg"), title: "High-Converting Websites", text: "Drag-and-Drop Landing Pages\nLead Capture Forms\nWeb Chat Widgets" },
          ],
        },
      },
      {
        type: "xs_products",
        label: "Product grid 22",
        labelAr: "شبكة منتجات ٢٢",
        description: "A large rounded dark panel with a violet glow along its lower edge: a centred heading, your collections as pills, and your products on round-cornered pictures with centred names.",
        descriptionAr: "لوحة داكنة كبيرة بحواف دائرية ووهج بنفسجي عند حافتها السفلية: عنوان في المنتصف وأقسامك كأزرار كبسولة، ومنتجاتك بصور دائرية الحواف وأسماء في المنتصف.",
        content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", heading: "Our Products", limit: 8, showSearch: false },
      },
      {
        type: "xs_banners",
        label: "Numbered steps 22",
        labelAr: "خطوات مرقّمة ٢٢",
        description: "A centred heading over wide rounded rows, each a small picture, a title standing on a large outlined number, and a sentence.",
        descriptionAr: "عنوان في المنتصف فوق صفوف عريضة بحواف دائرية، في كل صف صورة صغيرة وعنوان فوق رقم كبير مفرّغ وجملة.",
        content: {
          heading: "The 5 things every Business Needs",
          items: [
            { image: art("22", "step-1.png"), title: "TRAFFIC", text: "Drive more high-quality local leads to your business through optimized Google search and social visibility." },
            { image: art("22", "step-2.png"), title: "CAPTURE", text: "Convert website visitors into real conversations using web chat widgets and fast lead capture forms." },
            { image: art("22", "step-3.png"), title: "NURTURING", text: "Automatically follow up with every lead via SMS and email so no one slips through the cracks." },
            { image: art("22", "step-4.png"), title: "CONVERT", text: "Turn prospects into paying customers by making appointment booking and payments incredibly simple." },
            { image: art("22", "step-5.png"), title: "REFER", text: "Automatically request 5-star Google reviews from happy customers to drive even more organic traffic." },
          ],
        },
      },
      {
        type: "xs_gallery",
        label: "Brand logos 22",
        labelAr: "شعارات العلامات ٢٢",
        description: "A centred line over one quiet row of pale logos.",
        descriptionAr: "سطر في المنتصف فوق صف هادئ من الشعارات الفاتحة.",
        content: {
          variant: "logos",
          text: "Trusted by 10,000+ local businesses to scale their bookings and growth automatically.",
          images: [art("22", "brand-1.svg"), art("22", "brand-2.svg"), art("22", "brand-3.svg"), art("22", "brand-4.svg"), art("22", "brand-5.svg")],
        },
      },
      {
        type: "xs_quotes",
        label: "Quotes 22",
        labelAr: "آراء ٢٢",
        description: "Your customers' words on a dark rounded card over a violet glow, one at a time: a quote mark, white words, and a small round picture beside the name.",
        descriptionAr: "آراء عملائك على كارت داكن بحواف دائرية فوق وهج بنفسجي، واحدًا بعد الآخر: علامة اقتباس وكلام أبيض وصورة دائرية صغيرة بجانب الاسم.",
        content: {
          heading: "Real Stories From Local Business Owners",
          items: [
            { quote: "This all-in-one software is exactly what our local business needed. It completely eliminated our need for 4 other separate platforms and organized our entire customer pipeline.", name: "Ronald Richards", role: "Local Services Co.", image: art("22", "avatar.png") },
            { quote: "We used to lose at least 3-4 jobs a week because we couldn't answer the phone while on a roof. The Missed Call Auto-Responder immediately cut that to zero. This software pays for itself a hundred times over.", name: "Marvin McKinney", role: "Roofing Company Owner", image: art("22", "story-1.png") },
            { quote: "Our front desk was overwhelmed with appointment reminders and review requests. This system automated everything. Our show-up rate increased by 40% and our Google reviews doubled in two months.", name: "Sarah Jenkins", role: "Dental Practice Manager", image: art("22", "story-2.png") },
            { quote: "I finally cancelled my subscription to 5 different tools. Having the Smart Inbox, calendar, and text campaigns in one dashboard saved me nearly EGP 30,000 a month and made my life so much simpler.", name: "David Alaba", role: "HVAC Contractor", image: art("22", "story-3.png") },
          ],
        },
      },
      {
        type: "xs_features",
        label: "Three steps 22",
        labelAr: "ثلاث خطوات ٢٢",
        description: "A centred heading over three soft dark cards side by side, each a white icon, a numbered title and a sentence.",
        descriptionAr: "عنوان في المنتصف فوق ثلاثة كروت داكنة ناعمة متجاورة، في كل كارت أيقونة بيضاء وعنوان مرقّم وجملة.",
        content: {
          heading: "Your 3-Step Path to Automated Growth",
          items: [
            { icon: "bag", image: art("22", "ico-2.svg"), title: "1. Start Your Trial", text: "Sign up for a free trial and experience the power of the platform for yourself. No credit card required." },
            { icon: "support", image: art("22", "ico-2.svg"), title: "2. Connect Your Business", text: "Forward your calls, plug in your social accounts, and unify your inbox in a matter of clicks." },
            { icon: "truck", image: art("22", "ico-2.svg"), title: "3. Scale on Autopilot", text: "Watch your calendar fill up and reviews come in automatically, so you can focus on serving your customers." },
          ],
        },
        library: false,
      },
      {
        type: "xs_gallery",
        label: "App discs 22",
        labelAr: "دوائر التطبيقات ٢٢",
        description: "A centred heading over a row of overlapping frosted discs, each holding a small picture.",
        descriptionAr: "عنوان في المنتصف فوق صف من الدوائر الزجاجية المتداخلة، في كل دائرة صورة صغيرة.",
        content: {
          variant: "photos",
          heading: "Connect all your Applications",
          images: [art("22", "app-1.png"), art("22", "app-2.png"), art("22", "app-3.png"), art("22", "app-4.png"), art("22", "app-5.png"), art("22", "app-6.png"), art("22", "app-7.png"), art("22", "app-8.png")],
        },
        library: false,
      },
      {
        type: "xs_split",
        label: "Offer with a list 22",
        labelAr: "عرض بقائمة ٢٢",
        description: "A heading, a few short paragraphs, a green-ticked list and a gradient pill button beside a picture on a dark rounded card.",
        descriptionAr: "عنوان وفقرات قصيرة وقائمة بعلامات صح خضراء وزر كبسولة بتدرّج لوني، بجانب صورة على كارت داكن بحواف دائرية.",
        content: {
          images: [art("22", "ebook.png")],
          heading: "Free Resource for Local Business Owners",
          text: "The \"Leaking Bucket\" Audit: 5 Ways You're Losing Local Leads (And How to Fix Them).\n\nDid you know that most small businesses lose up to 50% of their potential sales simply because of slow follow-up?\n\nDownload our FREE Checklist to identify the \"lead leaks\" in your current business and learn how to plug them with simple software automation.",
          points: [
            "The Follow-Up Audit: A step-by-step guide to measuring your lead response time.",
            "Automation Quick-Wins: 3 workflows you can set up today to start booking more local appointments.",
            "The Tech Stack Check: Stop paying for 5 different software tools.",
          ],
          buttonLabel: "Get Free Checklist",
          buttonHref: "/contact",
        },
      },
      {
        type: "xs_newsletter",
        label: "Call to action 22",
        labelAr: "دعوة للاشتراك ٢٢",
        description: "A wide dark rounded card with a bright violet glow in its lower corner: a centred heading and line over a pill-shaped email box and a gradient button.",
        descriptionAr: "كارت داكن عريض بحواف دائرية وفي ركنه السفلي وهج بنفسجي ساطع: عنوان وسطر في المنتصف فوق خانة بريد على شكل كبسولة وزر بتدرّج لوني.",
        content: {
          heading: "Ready to put Your Local Business Growth on Autopilot?",
          text: "Stop wasting thousands on scattered tools that don't convert and start enjoying streamlined, predictable growth.",
          placeholder: "Email Address",
          buttonLabel: "Start Your 14-Days Free Trial",
        },
      },
      {
        type: "xs_title",
        label: "Page title 22",
        labelAr: "عنوان صفحة ٢٢",
        description: "The page's name in very large white letters under a violet glow.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة جدًا تحت وهج بنفسجي.",
        content: { heading: "Your System-Driven Growth Partner." },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_story",
        label: "Letter 22",
        labelAr: "رسالة ٢٢",
        description: "A letter in a box ruled down both sides with a small white square on each corner: a centred title, a round portrait, the text, then closing words and a signature.",
        descriptionAr: "رسالة داخل إطار بخطين جانبيين ومربع أبيض صغير في كل ركن: عنوان في المنتصف وصورة شخصية دائرية ثم النص، وفي آخرها كلمة ختامية وتوقيع.",
        content: {
          items: [
            {
              title: "Why We Do What We Do - A Letter From Our CEO",
              body: "At Automark, we know you started your local business to serve your community, not to become a software engineer. The problem is most modern marketing tools are too complex, scattered, and disconnected, which leaves you feeling overwhelmed and stuck in the daily admin grind.\n\nWe believe you shouldn't have to pay for five different subscriptions or spend your weekends sending emails just to grow your company. We understand how frustrating it is to watch hard-earned leads slip through the cracks, which is why we built a single, unified platform that puts your follow-ups, reviews, and bookings on complete autopilot.",
              quote: "Stop wasting money on scattered tools that don't talk to each other, and instead enjoy a streamlined business with consistent, predictable revenue growth.",
              quoteAuthor: "Ronald Richards, Founder & CEO",
              image: art("22", "ceo.png"),
            },
          ],
        },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_team",
        label: "Team 22",
        labelAr: "فريق العمل ٢٢",
        description: "A centred heading over four people, each on a round-cornered square picture with a violet glow rising behind, the name and role centred beneath.",
        descriptionAr: "عنوان في المنتصف فوق أربعة أشخاص، كل واحد على صورة مربعة بحواف دائرية وخلفها وهج بنفسجي، وتحتها الاسم والوظيفة في المنتصف.",
        content: {
          heading: "Meet Our Team Of Experts",
          items: [
            { image: art("22", "team-1.png"), name: "Josh Wangombe", role: "Co-Founder & CTO" },
            { image: art("22", "team-2.png"), name: "Daniel Jenson", role: "Co-Founder & CEO" },
            { image: art("22", "team-3.png"), name: "Toun Aalbers", role: "Co-Founder & CTO" },
            { image: art("22", "team-4.png"), name: "Peter van Ursel", role: "Customer Success Director" },
          ],
        },
        page: { path: "/about", title: "About" },
      },
      {
        type: "xs_title",
        label: "Page title 22",
        labelAr: "عنوان صفحة ٢٢",
        description: "The page's name in very large white letters under a violet glow.",
        descriptionAr: "اسم الصفحة بحروف بيضاء كبيرة جدًا تحت وهج بنفسجي.",
        content: { heading: "Contact Us" },
        page: { path: "/contact", title: "Contact" },
        library: false,
      },
      {
        type: "xs_contact",
        label: "Contact 22",
        labelAr: "تواصل ٢٢",
        description: "Your email and phone on soft dark cards beside a message form with pill-shaped boxes and a gradient button. Messages arrive in your Contacts.",
        descriptionAr: "بريدك وهاتفك على كروت داكنة ناعمة بجانب نموذج رسالة بخانات على شكل كبسولة وزر بتدرّج لوني. الرسائل تصل إلى جهات الاتصال.",
        content: {
          heading: "Have a question? Send us a message",
          contactPlaceholder: "Email Address",
          messagePlaceholder: "Write your message...",
          buttonLabel: "Send Message",
          info: [
            { icon: "email", title: "Email Us", text: "We reply to every message within one business day" },
            { icon: "phone", title: "Call or Text Us", text: "Sunday to Thursday, 9 am to 6 pm" },
          ],
        },
        page: { path: "/contact", title: "Contact" },
      },
    ],
  },
];

const presetKey = (look: string, type: XsType) => `xs-${look}-${type.slice(3).replace(/_/g, "-")}`;

const VISIBLE = XS_TEMPLATES.filter((template) => !XS_HIDDEN_LOOKS.includes(template.look));

/** One block per band of each template: a full-bleed section holding that single element. */
export const XS_PRESETS: BlockPreset[] = VISIBLE.flatMap((template) =>
  template.bands
    .filter((band) => band.library !== false)
    .map((band) => ({
    key: presetKey(template.look, band.type),
    label: band.label,
    description: band.description,
    icon: XS_ELEMENT_SPECS[band.type].icon,
    group: GROUP[band.type],
    elements: [band.type],
    content: [{ look: template.look, ...band.content }],
    settings: { width: "full", padding: "tight" },
  }))
);

/** The blocks' names and descriptions in Arabic, keyed like PRESET_AR in editorLocale.ts. */
export const XS_PRESET_AR: Record<string, { label: string; description: string }> = Object.fromEntries(
  VISIBLE.flatMap((template) =>
    template.bands.filter((band) => band.library !== false).map((band) => [presetKey(template.look, band.type), { label: band.labelAr, description: band.descriptionAr }])
  )
);

/**
 * A template's other home pages: the same look and the same kinds of band,
 * composed differently (other pictures, banners edge to edge or in two rows).
 * Each is offered in the gallery as its own template (templates/xs) beside
 * the look's first; its other pages are the look's own.
 */
const XS_ALT_HOMES: Record<string, Array<{ type: XsType; content?: Record<string, unknown> }>> = {
  "01b": [
    {
      type: "xs_slider",
      content: {
        slides: [
          { image: art("01", "slide-02.jpg"), eyebrow: "Men Collection 2018", heading: "New arrivals", buttonLabel: "Shop Now", buttonHref: "/products" },
          { image: art("01", "slide-03.jpg"), eyebrow: "Men New-Season", heading: "Jackets & Coats", buttonLabel: "Shop Now", buttonHref: "/products" },
          { image: art("01", "slide-04.jpg"), eyebrow: "Women Collection 2018", heading: "NEW SEASON", buttonLabel: "Shop Now", buttonHref: "/products" },
        ],
      },
    },
    {
      type: "xs_banners",
      content: {
        wide: true,
        items: [
          { image: art("01", "banner-04.jpg"), title: "Women", text: "Spring 2018", linkLabel: "Shop Now", href: "/products" },
          { image: art("01", "banner-05.jpg"), title: "Men", text: "Spring 2018", linkLabel: "Shop Now", href: "/products" },
          { image: art("01", "banner-06.jpg"), title: "Bags", text: "New Trend", linkLabel: "Shop Now", href: "/products" },
        ],
      },
    },
    { type: "xs_products", content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", heading: "Store Overview", limit: 8, showSearch: false } },
    // Its content is the look's own article band (the one marked onPage: false).
    { type: "xs_posts" },
  ],
  "01c": [
    {
      type: "xs_slider",
      content: {
        slides: [
          { image: art("01", "slide-05.jpg"), eyebrow: "Women Collection 2018", heading: "New arrivals", buttonLabel: "Shop Now", buttonHref: "/products" },
          { image: art("01", "slide-06.jpg"), eyebrow: "Men New-Season", heading: "Jackets & Coats", buttonLabel: "Shop Now", buttonHref: "/products" },
          { image: art("01", "slide-07.jpg"), eyebrow: "Men Collection 2018", heading: "NEW SEASON", buttonLabel: "Shop Now", buttonHref: "/products" },
        ],
      },
    },
    {
      type: "xs_banners",
      content: {
        columns: 2,
        items: [
          { image: art("01", "banner-04.jpg"), title: "Women", text: "New Trend", linkLabel: "Shop Now", href: "/products" },
          { image: art("01", "banner-05.jpg"), title: "Men", text: "New Trend", linkLabel: "Shop Now", href: "/products" },
        ],
      },
    },
    {
      type: "xs_banners",
      content: {
        items: [
          { image: art("01", "banner-07.jpg"), title: "Watches", text: "Spring 2018", linkLabel: "Shop Now", href: "/products" },
          { image: art("01", "banner-08.jpg"), title: "Bags", text: "Spring 2018", linkLabel: "Shop Now", href: "/products" },
          { image: art("01", "banner-09.jpg"), title: "Accessories", text: "Spring 2018", linkLabel: "Shop Now", href: "/products" },
        ],
      },
    },
    { type: "xs_products", content: { allLabel: "All Products", searchLabel: "Search", searchPlaceholder: "Search", loadMoreLabel: "Load More", viewLabel: "Quick View", openLabel: "Add to cart", heading: "Product Overview", limit: 16 } },
  ],
};

/**
 * The pages of one template, home first, each with its bands in the order the
 * template stacks them: a band's type and starting props. What the template
 * gallery's copy of the template is built from (templates/xs/xsTemplates.ts),
 * so the pages a store starts with and the blocks in the library are the same
 * bands.
 */
export function xsTemplatePages(look: string, home?: string): Array<{ path: string; title: string; bands: Array<{ type: XsType; props: Record<string, unknown> }> }> {
  const template = XS_TEMPLATES.find((t) => t.look === look);
  const pages: Array<{ path: string; title: string; bands: Array<{ type: XsType; props: Record<string, unknown> }> }> = [];
  for (const band of template?.bands ?? []) {
    if (band.onPage === false) continue;
    const { path, title } = band.page ?? { path: "/", title: "Home" };
    let page = pages.find((p) => p.path === path);
    if (!page) pages.push((page = { path, title, bands: [] }));
    page.bands.push({ type: band.type, props: { ...XS_ELEMENT_SPECS[band.type].defaultProps, look, ...band.content } });
  }
  // Another home page of the same look (XS_ALT_HOMES): its bands stand in for the first's.
  const alt = home ? XS_ALT_HOMES[home] : undefined;
  const first = pages.find((p) => p.path === "/");
  if (alt && first) {
    first.bands = alt.map((band) => {
      const content = band.content ?? template?.bands.find((b) => b.type === band.type && b.onPage === false)?.content;
      return { type: band.type, props: { ...XS_ELEMENT_SPECS[band.type].defaultProps, look, ...content } };
    });
  }
  return pages;
}
