import {
  AlignLeft,
  ChevronDown,
  CircleDot,
  Code2,
  Columns3,
  FormInput,
  Grid3x3,
  Heading1,
  HelpCircle,
  Image,
  Images,
  LayoutGrid,
  List,
  Map,
  Minus,
  MousePointerClick,
  MoveVertical,
  Quote,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Timer,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import type {
  PageColumn,
  PageElement,
  PageElementType,
  PageRow,
  PageSection,
  PageTree,
} from "@store-builder/api-client";

/**
 * The editor's model of the backend page tree (modules/pages/pageTree.js).
 *
 * Two things about that tree drive every decision here:
 *
 *  1. Sections are NOT typed. `section.type` is always the literal "section" —
 *     there is no hero/footer discriminator. The only typed nodes are the leaf
 *     `elements`, and their types come from a fixed backend allowlist of 23.
 *     So a "block" in the UI is a *preset*: a section wrapping one row, one
 *     full-width column, and one or more elements.
 *  2. The seeded templates build every section through the same `oneCol`
 *     helper (one row → one span-12 column), so the trees we read back are
 *     always single-column. We write the same shape, and the canvas renders a
 *     section by flattening it — that way a hand-authored multi-column tree
 *     still displays and still round-trips unharmed.
 */

// ---------------------------------------------------------------------------
// Field descriptors — what the inspector renders for one element's props
// ---------------------------------------------------------------------------

export type FieldSpec =
  | { key: string; label: string; kind: "text"; placeholder?: string; hint?: string }
  | { key: string; label: string; kind: "textarea"; placeholder?: string; hint?: string }
  | { key: string; label: string; kind: "number"; min?: number; max?: number; hint?: string }
  | { key: string; label: string; kind: "boolean"; hint?: string }
  | {
      key: string;
      label: string;
      kind: "select";
      options: Array<{ value: string; label: string }>;
      hint?: string;
    }
  | { key: string; label: string; kind: "image"; hint?: string }
  | { key: string; label: string; kind: "stringList"; itemLabel: string; hint?: string }
  | { key: string; label: string; kind: "imageList"; hint?: string }
  | { key: string; label: string; kind: "qaList"; hint?: string }
  | { key: string; label: string; kind: "linkList"; hint?: string };

interface ElementSpec {
  label: string;
  icon: LucideIcon;
  defaultProps: Record<string, unknown>;
  fields: FieldSpec[];
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `H${n}` }));

/**
 * One entry per allowed element type. `defaultProps` mirrors the props the
 * seeded templates actually use, so a block added here looks like a block that
 * came from a template.
 */
export const ELEMENT_SPECS: Record<PageElementType, ElementSpec> = {
  heading: {
    label: "Heading",
    icon: Heading1,
    defaultProps: { text: "New heading", level: 2 },
    fields: [
      { key: "text", label: "Text", kind: "text" },
      { key: "level", label: "Level", kind: "select", options: HEADING_LEVELS },
    ],
  },
  text: {
    label: "Text",
    icon: AlignLeft,
    defaultProps: { text: "Write something about your store." },
    fields: [{ key: "text", label: "Text", kind: "textarea" }],
  },
  rich_text: {
    label: "Long text",
    icon: Type,
    defaultProps: { text: "" },
    fields: [
      {
        key: "text",
        label: "Text",
        kind: "textarea",
        hint: "Plain text only in this editor — formatting controls come later.",
      },
    ],
  },
  image: {
    label: "Image",
    icon: Image,
    defaultProps: { src: "", alt: "" },
    fields: [
      { key: "src", label: "Image", kind: "image" },
      { key: "alt", label: "Alt text", kind: "text", hint: "Describes the image to screen readers." },
      { key: "href", label: "Links to", kind: "text", placeholder: "/products" },
    ],
  },
  gallery: {
    label: "Gallery",
    icon: Images,
    defaultProps: { title: "Gallery", images: [], columns: 3 },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "images", label: "Images", kind: "imageList" },
      { key: "columns", label: "Columns", kind: "number", min: 1, max: 6 },
    ],
  },
  button: {
    label: "Button",
    icon: MousePointerClick,
    defaultProps: { label: "Shop now", href: "/products", variant: "primary" },
    fields: [
      { key: "label", label: "Button text", kind: "text" },
      { key: "href", label: "Links to", kind: "text", placeholder: "/products" },
      {
        key: "variant",
        label: "Style",
        kind: "select",
        options: [
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
          { value: "outline", label: "Outline" },
        ],
      },
    ],
  },
  video: {
    label: "Video",
    icon: Video,
    defaultProps: { url: "", title: "" },
    fields: [
      { key: "url", label: "Video URL", kind: "text", placeholder: "https://youtube.com/watch?v=…" },
      { key: "title", label: "Title", kind: "text" },
    ],
  },
  embed: {
    label: "Embed",
    icon: Code2,
    defaultProps: { url: "", title: "" },
    fields: [
      {
        key: "url",
        label: "Embed URL",
        kind: "text",
        hint: "A URL to embed. Raw HTML is rejected by the server.",
      },
      { key: "title", label: "Title", kind: "text" },
    ],
  },
  spacer: {
    label: "Spacer",
    icon: MoveVertical,
    defaultProps: { height: 48 },
    fields: [{ key: "height", label: "Height (px)", kind: "number", min: 4, max: 400 }],
  },
  divider: {
    label: "Divider",
    icon: Minus,
    defaultProps: {},
    fields: [
      {
        key: "style",
        label: "Style",
        kind: "select",
        options: [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
        ],
      },
    ],
  },
  icon: {
    label: "Icon",
    icon: CircleDot,
    defaultProps: { name: "star", size: 32 },
    fields: [
      { key: "name", label: "Icon name", kind: "text", placeholder: "star" },
      { key: "size", label: "Size (px)", kind: "number", min: 8, max: 200 },
    ],
  },
  list: {
    label: "List",
    icon: List,
    defaultProps: { title: "", items: [] },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Items", kind: "stringList", itemLabel: "Item" },
    ],
  },
  accordion: {
    label: "Accordion",
    icon: ChevronDown,
    defaultProps: { title: "", items: [] },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Rows", kind: "qaList" },
    ],
  },
  faq: {
    label: "FAQ",
    icon: HelpCircle,
    defaultProps: { title: "الأسئلة الشائعة", items: [] },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Questions", kind: "qaList" },
    ],
  },
  testimonial: {
    label: "Testimonial",
    icon: Quote,
    defaultProps: { quote: "", author: "", rating: 5 },
    fields: [
      { key: "quote", label: "Quote", kind: "textarea" },
      { key: "author", label: "Author", kind: "text" },
      { key: "rating", label: "Rating", kind: "number", min: 0, max: 5 },
    ],
  },
  countdown: {
    label: "Countdown",
    icon: Timer,
    defaultProps: { label: "ينتهي العرض خلال", endsInHours: 24 },
    fields: [
      { key: "label", label: "Label", kind: "text" },
      { key: "endsInHours", label: "Ends in (hours)", kind: "number", min: 1, max: 8760 },
    ],
  },
  form: {
    label: "Form",
    icon: FormInput,
    defaultProps: { title: "", submitLabel: "Send" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "submitLabel", label: "Submit button text", kind: "text" },
    ],
  },
  map: {
    label: "Map",
    icon: Map,
    defaultProps: { address: "", zoom: 14 },
    fields: [
      { key: "address", label: "Address", kind: "text" },
      { key: "zoom", label: "Zoom", kind: "number", min: 1, max: 20 },
    ],
  },
  social_icons: {
    label: "Social links",
    icon: Share2,
    defaultProps: { links: [] },
    fields: [{ key: "links", label: "Links", kind: "linkList" }],
  },
  product_card: {
    label: "Single product",
    icon: ShoppingBag,
    defaultProps: { title: "", showPrice: true, showBuyButton: true },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "productId", label: "Product ID", kind: "text", hint: "Leave empty to use the newest product." },
      { key: "showPrice", label: "Show price", kind: "boolean" },
      { key: "showBuyButton", label: "Show buy button", kind: "boolean" },
    ],
  },
  product_list: {
    label: "Product grid",
    icon: LayoutGrid,
    defaultProps: { title: "Featured products", source: "newest", limit: 8, columns: 4 },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      {
        key: "source",
        label: "Show",
        kind: "select",
        options: [
          { value: "newest", label: "Newest" },
          { value: "featured", label: "Featured" },
          { value: "best_selling", label: "Best selling" },
        ],
      },
      { key: "limit", label: "How many", kind: "number", min: 1, max: 48 },
      { key: "columns", label: "Columns", kind: "number", min: 1, max: 6 },
    ],
  },
  collection_list: {
    label: "Collections",
    icon: Grid3x3,
    defaultProps: { title: "Shop by collection", limit: 6, columns: 3 },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "limit", label: "How many", kind: "number", min: 1, max: 24 },
      { key: "columns", label: "Columns", kind: "number", min: 1, max: 6 },
    ],
  },
  cart: {
    label: "Cart",
    icon: ShoppingCart,
    defaultProps: { title: "Your cart" },
    fields: [{ key: "title", label: "Title", kind: "text" }],
  },
};

// ---------------------------------------------------------------------------
// Block presets — what the left sidebar offers
// ---------------------------------------------------------------------------

export interface BlockPreset {
  /** Stable key, also the id prefix of the section it creates. */
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "Layout" | "Content" | "Media" | "Commerce";
  /** The element types this preset drops into one full-width column. */
  elements: PageElementType[];
}

export const BLOCK_PRESETS: BlockPreset[] = [
  {
    key: "hero",
    label: "Hero",
    description: "Big heading, a line of text and a call-to-action button.",
    icon: Sparkles,
    group: "Layout",
    elements: ["heading", "text", "button"],
  },
  {
    key: "heading",
    label: "Heading",
    description: "A standalone section title.",
    icon: Heading1,
    group: "Content",
    elements: ["heading"],
  },
  {
    key: "text",
    label: "Text",
    description: "A paragraph of copy.",
    icon: AlignLeft,
    group: "Content",
    elements: ["text"],
  },
  {
    key: "rich-text",
    label: "Long text",
    description: "A longer block of copy.",
    icon: Type,
    group: "Content",
    elements: ["rich_text"],
  },
  {
    key: "list",
    label: "List",
    description: "A bulleted list of points.",
    icon: List,
    group: "Content",
    elements: ["list"],
  },
  {
    key: "button",
    label: "Button",
    description: "A single call-to-action button.",
    icon: MousePointerClick,
    group: "Content",
    elements: ["button"],
  },
  {
    key: "testimonial",
    label: "Testimonial",
    description: "A customer quote with a rating.",
    icon: Quote,
    group: "Content",
    elements: ["testimonial"],
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Question-and-answer pairs.",
    icon: HelpCircle,
    group: "Content",
    elements: ["faq"],
  },
  {
    key: "accordion",
    label: "Accordion",
    description: "Collapsible rows of content.",
    icon: ChevronDown,
    group: "Content",
    elements: ["accordion"],
  },
  {
    key: "form",
    label: "Form",
    description: "A contact or sign-up form.",
    icon: FormInput,
    group: "Content",
    elements: ["form"],
  },
  {
    key: "image",
    label: "Image",
    description: "One image, optionally linked.",
    icon: Image,
    group: "Media",
    elements: ["image"],
  },
  {
    key: "gallery",
    label: "Gallery",
    description: "A grid of images.",
    icon: Images,
    group: "Media",
    elements: ["gallery"],
  },
  {
    key: "video",
    label: "Video",
    description: "An embedded video.",
    icon: Video,
    group: "Media",
    elements: ["video"],
  },
  {
    key: "embed",
    label: "Embed",
    description: "Embed an external page by URL.",
    icon: Code2,
    group: "Media",
    elements: ["embed"],
  },
  {
    key: "map",
    label: "Map",
    description: "Show your address on a map.",
    icon: Map,
    group: "Media",
    elements: ["map"],
  },
  {
    key: "icon",
    label: "Icon",
    description: "A single decorative icon.",
    icon: CircleDot,
    group: "Media",
    elements: ["icon"],
  },
  {
    key: "social",
    label: "Social links",
    description: "Links to your social profiles.",
    icon: Share2,
    group: "Media",
    elements: ["social_icons"],
  },
  {
    key: "products",
    label: "Product grid",
    description: "A grid of products from your catalog.",
    icon: LayoutGrid,
    group: "Commerce",
    elements: ["product_list"],
  },
  {
    key: "offer",
    label: "Single product",
    description: "Spotlight one product with a buy button.",
    icon: ShoppingBag,
    group: "Commerce",
    elements: ["product_card"],
  },
  {
    key: "collections",
    label: "Collections",
    description: "Let shoppers browse by collection.",
    icon: Grid3x3,
    group: "Commerce",
    elements: ["collection_list"],
  },
  {
    key: "countdown",
    label: "Countdown",
    description: "An urgency timer for a limited offer.",
    icon: Timer,
    group: "Commerce",
    elements: ["countdown"],
  },
  {
    key: "cart",
    label: "Cart",
    description: "The shopper's cart contents.",
    icon: ShoppingCart,
    group: "Commerce",
    elements: ["cart"],
  },
  {
    key: "divider",
    label: "Divider",
    description: "A horizontal rule between sections.",
    icon: Minus,
    group: "Layout",
    elements: ["divider"],
  },
  {
    key: "spacer",
    label: "Spacer",
    description: "Vertical breathing room.",
    icon: MoveVertical,
    group: "Layout",
    elements: ["spacer"],
  },
];

export const BLOCK_GROUPS: BlockPreset["group"][] = ["Layout", "Content", "Media", "Commerce"];

// ---------------------------------------------------------------------------
// Tree construction + immutable edits
// ---------------------------------------------------------------------------

/**
 * Ids only have to be non-empty strings server-side, but the seeded templates
 * use fixed slugs ("hero-h", "hero-btn"), so adding a second hero would collide
 * on the client where we key by id. Every id we mint gets a random suffix.
 */
function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${prefix}-${rand}`;
}

function createElement(type: PageElementType): PageElement {
  return { id: uid(type), type, props: { ...ELEMENT_SPECS[type].defaultProps } };
}

/** One section → one row → one span-12 column, matching the seeder's `oneCol`. */
export function createSection(preset: BlockPreset): PageSection {
  const base = uid(preset.key);
  const column: PageColumn = {
    id: `${base}-c`,
    type: "column",
    span: 12,
    elements: preset.elements.map(createElement),
  };
  const row: PageRow = { id: `${base}-r`, type: "row", columns: [column] };
  return { id: base, type: "section", rows: [row] };
}

/** Every element in a section, in document order, across all rows/columns. */
export function sectionElements(section: PageSection): PageElement[] {
  return (section.rows ?? []).flatMap((row) =>
    (row.columns ?? []).flatMap((col) => col.elements ?? [])
  );
}

/**
 * A display name for a section. The tree has no section type, so this reads
 * the elements: an exact preset match wins (that's how a template's hero gets
 * called "Hero"), otherwise fall back to the first element's own label.
 */
export function sectionLabel(section: PageSection): string {
  const types = sectionElements(section).map((el) => el.type);
  if (types.length === 0) return "Empty section";
  const match = BLOCK_PRESETS.find(
    (p) => p.elements.length === types.length && p.elements.every((t, i) => t === types[i])
  );
  if (match) return match.label;
  const first = ELEMENT_SPECS[types[0]];
  return types.length === 1 ? first.label : `${first.label} + ${types.length - 1} more`;
}

export function sectionIcon(section: PageSection): LucideIcon {
  const types = sectionElements(section).map((el) => el.type);
  const match = BLOCK_PRESETS.find(
    (p) => p.elements.length === types.length && p.elements.every((t, i) => t === types[i])
  );
  if (match) return match.icon;
  return types.length > 0 ? ELEMENT_SPECS[types[0]].icon : Columns3;
}

/** Replaces one element (matched by id) anywhere in the section. */
export function replaceElement(
  section: PageSection,
  elementId: string,
  next: PageElement
): PageSection {
  return {
    ...section,
    rows: (section.rows ?? []).map((row) => ({
      ...row,
      columns: (row.columns ?? []).map((col) => ({
        ...col,
        elements: (col.elements ?? []).map((el) => (el.id === elementId ? next : el)),
      })),
    })),
  };
}

export function setElementProp(
  section: PageSection,
  element: PageElement,
  key: string,
  value: unknown
): PageSection {
  const props = { ...(element.props ?? {}), [key]: value };
  return replaceElement(section, element.id, { ...element, props });
}

export function moveSection(sections: PageSection[], from: number, to: number): PageSection[] {
  if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length) {
    return sections;
  }
  const next = sections.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Guards against a page whose `draftData` is null or predates the tree shape.
 * `version` and any `globalStyles` are carried through untouched — the editor
 * has no styling controls in this phase and must not drop what it can't edit.
 */
export function normalizeTree(data: unknown): PageTree {
  if (data && typeof data === "object" && Array.isArray((data as PageTree).sections)) {
    const tree = data as PageTree;
    return { ...tree, version: tree.version ?? 1, sections: tree.sections };
  }
  return { version: 1, sections: [] };
}
