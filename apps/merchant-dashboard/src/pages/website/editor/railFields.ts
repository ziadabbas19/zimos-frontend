import type { FieldSpec } from "./blocks";

/**
 * The clothing rail's settings: the template look's band `xs_rail`
 * (xsBlocks.ts). Their Arabic labels are in editorLocale.ts under `xs_rail.`.
 */
export const RAIL_DEFAULTS = {
  eyebrow: "",
  heading: "",
  caption: "",
  ctaLabel: "",
  ctaHref: "/products",
  limit: 10,
  collectionId: "",
  hanger: "wood",
  sidePhotos: false,
  autoplay: true,
};

export const RAIL_FIELDS: FieldSpec[] = [
  { key: "eyebrow", label: "Small line above", kind: "text" },
  { key: "heading", label: "Heading", kind: "text" },
  {
    key: "caption",
    label: "Line under the rail",
    kind: "text",
    hint: "Shown until the shopper turns a piece to the front; then that piece's name shows instead.",
  },
  { key: "ctaLabel", label: "Button text", kind: "text" },
  { key: "ctaHref", label: "Button links to", kind: "text", placeholder: "/products" },
  { key: "limit", label: "How many", kind: "number", min: 3, max: 16 },
  { key: "collectionId", label: "Collection", kind: "collection", hint: "Leave empty for the whole catalogue." },
  {
    key: "hanger",
    label: "Hanger",
    kind: "select",
    options: [
      { value: "wood", label: "Wood" },
      { value: "matte", label: "Matte" },
      { value: "none", label: "None — my photos have their own" },
    ],
    hint: "Each product hangs as its first photo, and its second photo is the back. Photos on a transparent background look best; a product without a photo is drawn in its colour.",
  },
  {
    key: "sidePhotos",
    label: "Third photo shows the side",
    kind: "boolean",
    hint: "Turn on when every product's third photo is taken from the side: pieces rest on the rail showing it.",
  },
  {
    key: "autoplay",
    label: "Turn the pieces one by one",
    kind: "boolean",
    hint: "Until the shopper touches the rail.",
  },
];
