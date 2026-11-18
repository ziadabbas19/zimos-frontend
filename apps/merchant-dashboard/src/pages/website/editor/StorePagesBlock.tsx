import { Button, Input } from "@store-builder/ui";
import { Segmented } from "@/components/Segmented";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ImageField } from "./ImageField";
import { useEditorLocale } from "./editorLocale";
import { LookBlock } from "./theme/parts";

/**
 * The store's own pages — catalogue, product, cart, checkout — on a store
 * that wears an imported template: the editor's half of storefront
 * lib/xsStorePages.ts, saved as `themeSettings.storePages`. Each choice
 * starts as the template's (TEMPLATE_PAGES, the same table as the
 * storefront's STORE_PAGES) and only what the merchant changes is saved.
 */

type Strip = "band" | "title" | "inline" | "none";
type Template = { strip?: Strip; thumbs?: "side" | "below"; tabs?: "center" | "start"; image?: string };

export const TEMPLATE_PAGES: Record<string, Template> = {
  "01": { strip: "inline", thumbs: "side", tabs: "center" },
  "02": { strip: "title" },
  "04": { thumbs: "side", tabs: "center" },
  "05": { thumbs: "side", tabs: "center" },
  "06": { tabs: "center" },
  "07": { strip: "title", image: "/xs/07/cart-page-header-img.jpg" },
  "08": { strip: "title", tabs: "center" },
  "14": { strip: "title" },
  "15": { thumbs: "side", tabs: "center" },
  "17": { strip: "title", image: "/xs/17/tasty.jpg" },
  "18": { strip: "title", image: "/xs/18/hero-bg.jpg" },
  "19": { strip: "title", image: "/xs/19/hero.jpg" },
  "20": { strip: "title", image: "/xs/20/bg-hero.jpg" },
};

export interface StorePages {
  strip: Strip;
  image: string;
  thumbs: "side" | "below";
  tabs: "center" | "start";
  titles: { catalog: string; cart: string; checkout: string };
  related: string;
}

type Blob = Record<string, unknown>;
const objectOf = (value: unknown): Blob | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Blob) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");

/** What the pages show: the merchant's choices over the template's. */
export function readStorePages(saved: unknown, look: string): StorePages {
  const own = objectOf(saved) ?? {};
  const template = TEMPLATE_PAGES[look] ?? {};
  const titles = objectOf(own.titles) ?? {};
  return {
    strip: (["band", "title", "inline", "none"] as const).find((s) => s === own.strip) ?? template.strip ?? "band",
    image: text(own.image),
    thumbs: own.thumbs === "side" || own.thumbs === "below" ? own.thumbs : (template.thumbs ?? "below"),
    tabs: own.tabs === "center" || own.tabs === "start" ? own.tabs : (template.tabs ?? "start"),
    titles: { catalog: text(titles.catalog), cart: text(titles.cart), checkout: text(titles.checkout) },
    related: text(own.related),
  };
}

/** The saved blob: only what differs from the template; undefined when nothing does. */
export function writeStorePages(pages: StorePages, look: string): Blob | undefined {
  const template = readStorePages(undefined, look);
  const out: Blob = {};
  if (pages.strip !== template.strip) out.strip = pages.strip;
  if (pages.image.trim()) out.image = pages.image.trim();
  // Words as typed (a space mid-word survives); the storefront trims them.
  if (pages.thumbs !== template.thumbs) out.thumbs = pages.thumbs;
  if (pages.tabs !== template.tabs) out.tabs = pages.tabs;
  const titles = Object.fromEntries(Object.entries(pages.titles).filter(([, value]) => value.trim()));
  if (Object.keys(titles).length > 0) out.titles = titles;
  if (pages.related.trim()) out.related = pages.related;
  return Object.keys(out).length > 0 ? out : undefined;
}

const WORDS = {
  en: {
    title: "Shop and product pages",
    hint: "How the catalogue, a product, the cart and checkout look in this template. Each starts as the template's own.",
    strip: "Page title",
    strips: { band: "Band", title: "Picture", inline: "Trail only", none: "None" },
    picture: "The title's picture",
    thumbs: "A product's small pictures",
    side: "Beside",
    below: "Under",
    tabs: "A product's tabs",
    center: "Centred",
    start: "At the start",
    words: "Words",
    catalog: "Catalogue title",
    cart: "Cart title",
    checkout: "Checkout title",
    related: "Heading over similar products",
    storeOwn: "The store's own",
    reset: "Back to the template's",
  },
  ar: {
    title: "صفحات المتجر والمنتج",
    hint: "شكل صفحة المنتجات وصفحة المنتج والسلة والدفع في هذا القالب. كل اختيار يبدأ بما في القالب نفسه.",
    strip: "عنوان الصفحة",
    strips: { band: "شريط", title: "صورة", inline: "المسار فقط", none: "بدون" },
    picture: "صورة العنوان",
    thumbs: "صور المنتج الصغيرة",
    side: "بجانبها",
    below: "تحتها",
    tabs: "تبويبات المنتج",
    center: "في المنتصف",
    start: "في البداية",
    words: "الكلام",
    catalog: "عنوان صفحة المنتجات",
    cart: "عنوان السلة",
    checkout: "عنوان الدفع",
    related: "عنوان المنتجات المشابهة",
    storeOwn: "كلام المتجر الأصلي",
    reset: "رجوع لما في القالب",
  },
};

export function StorePagesBlock({ saved, onChange }: { saved: unknown; onChange: (next: Blob | undefined, historyKey?: string) => void }) {
  const locale = useEditorLocale();
  const w = WORDS[locale === "ar" ? "ar" : "en"];
  const { currentWorkspace } = useWorkspace();
  const look = currentWorkspace?.themeSettings?.xsLook;
  if (typeof look !== "string" || look === "") return null;
  const pages = readStorePages(saved, look);
  const set = (patch: Partial<StorePages>, key?: string) => onChange(writeStorePages({ ...pages, ...patch }, look), key);
  const field = (name: keyof StorePages["titles"], label: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <Input
        value={pages.titles[name]}
        dir="auto"
        maxLength={80}
        placeholder={w.storeOwn}
        className="h-9 text-sm"
        onChange={(e) => set({ titles: { ...pages.titles, [name]: e.target.value } }, `store-pages:${name}`)}
      />
    </label>
  );

  return (
    <LookBlock title={w.title} hint={w.hint}>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink-soft">{w.strip}</p>
        <Segmented<Strip>
          size="sm"
          label={w.strip}
          value={pages.strip}
          onChange={(strip) => set({ strip })}
          options={(["band", "title", "inline", "none"] as const).map((value) => ({ value, label: w.strips[value] }))}
        />
      </div>
      {pages.strip === "title" && (
        <ImageField
          label={w.picture}
          value={pages.image || TEMPLATE_PAGES[look]?.image || ""}
          onChange={(image) => set({ image: image === TEMPLATE_PAGES[look]?.image ? "" : image })}
        />
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink-soft">{w.thumbs}</p>
        <Segmented<"side" | "below">
          size="sm"
          label={w.thumbs}
          value={pages.thumbs}
          onChange={(thumbs) => set({ thumbs })}
          options={[
            { value: "side", label: w.side },
            { value: "below", label: w.below },
          ]}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink-soft">{w.tabs}</p>
        <Segmented<"center" | "start">
          size="sm"
          label={w.tabs}
          value={pages.tabs}
          onChange={(tabs) => set({ tabs })}
          options={[
            { value: "center", label: w.center },
            { value: "start", label: w.start },
          ]}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink-soft">{w.words}</p>
        {field("catalog", w.catalog)}
        {field("cart", w.cart)}
        {field("checkout", w.checkout)}
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink-soft">{w.related}</span>
          <Input
            value={pages.related}
            dir="auto"
            maxLength={80}
            placeholder={w.storeOwn}
            className="h-9 text-sm"
            onChange={(e) => set({ related: e.target.value }, "store-pages:related")}
          />
        </label>
      </div>
      {saved !== undefined && saved !== null && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(undefined)}>
          {w.reset}
        </Button>
      )}
    </LookBlock>
  );
}
