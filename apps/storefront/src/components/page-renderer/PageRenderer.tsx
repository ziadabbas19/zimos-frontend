import { BuilderExtraElement, EXTRA_ELEMENT_TYPES } from "./builderExtras";
import type {
  PageColumn,
  PageElement,
  PageRow,
  PageSection,
  PageTree,
} from "@store-builder/api-client";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";
import { setRequestMoneyFormat, type MoneyFormat } from "@/lib/moneyFormat";
import { getStoreMeta } from "@/lib/storeMeta";
import {
  CartElement,
  CollectionListElement,
  ProductCardElement,
  ShoppableImageElement,
  ProductListElement,
} from "./commerce";
import {
  AccordionElement,
  ButtonElement,
  CountdownElement,
  DividerElement,
  EmbedElement,
  FaqElement,
  FormElement,
  GalleryElement,
  HeadingElement,
  IconElement,
  ImageElement,
  ListElement,
  MapElement,
  SocialIconsElement,
  SpacerElement,
  TestimonialElement,
  TextElement,
  VideoElement,
} from "./elements";
import {
  OrbitGalleryElement,
  Product3DElement,
  ScrollStoryElement,
  ShaderHeroElement,
} from "./immersive";
import { ComparisonElement, MarqueeElement } from "./sections";
import {
  CarouselElement,
  CheckoutSummaryElement,
  CodFormElement,
  OrderSummaryElement,
  PriceElement,
  ReviewsListElement,
  StarsDisplayElement,
  TabsElement,
  TextLinkElement,
  ToggleElement,
  UpsellActionElement,
} from "./builderElements";
import { ShowcaseElement } from "./showcase";
import { columnClasses, heroSectionIndex, openingSectionIndex, rowClasses, sectionClasses, sectionHooks, sectionMinHeight } from "./layout";
import { SPAN_CLASS, propsOf, resolveHref, str } from "./props";
import { btnPrimary } from "@/components/ui";
import { pageStyleSheet, styleKey } from "./elementStyle";
import { applyBindings, loadBindingData, pageProductId, type BindingData } from "./bindings";
import { RepeaterElement } from "./repeater";
import { MasonryGridElement, ProductActionElement, productAction } from "./builderMore";

/**
 * An element with a style of its own (the editor's Style and Layout tabs) is
 * wrapped in a box its rules target; any other element is rendered bare, the
 * way it always was.
 */
function StyledElement({ element, ctx }: { element: PageElement; ctx: Ctx }) {
  const key = styleKey(element);
  if (!key) return <ElementNode element={element} ctx={ctx} />;
  return (
    <div data-zs={key}>
      <ElementNode element={element} ctx={ctx} />
    </div>
  );
}

/**
 * Renders a published page built in the merchant's website editor.
 *
 * The tree is the strict four-level shape the backend enforces on every write
 * (modules/pages/pageTree.js):
 *
 *   PageTree -> sections[] -> rows[] -> columns[] -> elements[]
 *
 * Only `elements` are typed; sections, rows and columns are pure containers, so
 * layout here is entirely structural — a row is a 12-column grid, a column
 * spans `span` of it, and elements stack inside. Grid order follows the
 * document direction, so an RTL store lays columns out right-to-left.
 *
 * Every node is treated as untrusted: the tree can come from a template, from
 * the editor, or from a hand-written API call, and only its *structure* was
 * validated server-side — never the props inside an element.
 */

/**
 * Funnel mode. A funnel keeps the shopper on one path, so the commerce blocks'
 * ways out — "order now" and "view details" on a product card, every card in
 * a product grid — go to the funnel step's own actions instead of the product
 * page, and the cart block is left out. `nextHref` is store-relative, like a
 * merchant link, so StoreLink puts the right prefix on it for either host.
 * Unset, nothing changes.
 */
export interface PageRendererFunnel {
  nextHref: string;
}

interface Ctx {
  workspaceId: string;
  currency: string;
  locale: Locale;
  t: Dictionary;
  funnel?: PageRendererFunnel;
  /**
   * The editor's preview: rows, columns and elements carry `data-zimos-*`
   * markers so the canvas can drag and resize them (components/preview). The
   * element marker is `display: contents`, so it adds no box of its own.
   */
  editable?: boolean;
  /** What the page's bindings and repeaters read (bindings.ts); null on a page that uses neither. */
  data: BindingData | null;
  /** The page's product, for product elements that name none; "" when the page has none. */
  pageProductId: string;
  /**
   * Set for the page's opening section only: its pictures are what a shopper
   * sees first, so they load at once and ahead of the rest instead of lazily.
   */
  opening?: boolean;
}

/** Elements whose empty `productId` means "the page's product". */
const PAGE_PRODUCT_TYPES = new Set(["button", "price", "reviews_list", "cod_form", "image_gallery", "variant_selector", "bundle_selector", "review_form"]);

function ElementNode({ element, ctx }: { element: PageElement; ctx: Ctx }) {
  // Bound props are replaced by live data before the element ever sees them.
  const bound = ctx.data ? applyBindings(element, ctx.data) : propsOf(element);
  // A product element with no product of its own follows the page's product.
  const props =
    ctx.pageProductId && PAGE_PRODUCT_TYPES.has(element.type) && !bound.productId
      ? { ...bound, productId: ctx.pageProductId }
      : bound;
  const { t } = ctx;

  switch (element.type) {
    case "heading":
      return <HeadingElement props={props} />;
    case "text":
      return <TextElement props={props} />;
    case "rich_text":
      return <TextElement props={props} large />;
    case "image":
      return <ImageElement props={props} eager={ctx.opening === true} />;
    case "gallery":
      return <GalleryElement props={props} />;
    case "button":
      // "Add to cart" / "Buy now" (item 93) — on the store; a funnel keeps its own path below.
      if (!ctx.funnel && productAction(props)) {
        return <ProductActionElement props={props} workspaceId={ctx.workspaceId} editable={ctx.editable === true} />;
      }
      // In a funnel, a button with no link of its own moves the shopper on:
      // FunnelStep reports the click with this element's id, so the funnel
      // map can route each button of a page to a different step.
      if (ctx.funnel && !resolveHref(str(props, "href")) && str(props, "label").trim()) {
        return (
          <button
            type="button"
            data-funnel-action="clicked_through"
            data-funnel-source={element.id}
            className={`w-fit self-start ${btnPrimary}`}
          >
            {str(props, "label")}
          </button>
        );
      }
      return <ButtonElement props={props} />;
    case "video":
      return <VideoElement props={props} t={t} />;
    case "embed":
      return <EmbedElement props={props} t={t} />;
    case "spacer":
      return <SpacerElement props={props} />;
    case "divider":
      return <DividerElement props={props} />;
    case "icon":
      return <IconElement props={props} />;
    case "list":
      return <ListElement props={props} />;
    case "accordion":
      return <AccordionElement props={props} t={t} />;
    case "faq":
      return <FaqElement props={props} t={t} />;
    case "testimonial":
      return <TestimonialElement props={props} t={t} />;
    case "countdown":
      return <CountdownElement props={props} />;
    case "form":
      return <FormElement props={props} t={t} workspaceId={ctx.workspaceId} elementId={element.id} disabled={ctx.editable} />;
    case "map":
      return <MapElement props={props} t={t} />;
    case "social_icons":
      return <SocialIconsElement props={props} t={t} />;
    case "product_card":
      return (
        <ProductCardElement
          props={props}
          workspaceId={ctx.workspaceId}
          currency={ctx.currency}
          locale={ctx.locale}
          funnel={ctx.funnel}
        />
      );
    case "shoppable_image":
      return <ShoppableImageElement props={props} workspaceId={ctx.workspaceId} />;
    case "product_list":
      return (
        <ProductListElement
          props={props}
          workspaceId={ctx.workspaceId}
          currency={ctx.currency}
          locale={ctx.locale}
          funnel={ctx.funnel}
        />
      );
    case "collection_list":
      return <CollectionListElement props={props} workspaceId={ctx.workspaceId} locale={ctx.locale} />;
    case "cart":
      // The cart is a way out of a funnel.
      return ctx.funnel ? null : <CartElement props={props} />;
    case "shader_hero":
      return <ShaderHeroElement props={props} locale={ctx.locale} />;
    case "product_3d":
      return <Product3DElement props={props} workspaceId={ctx.workspaceId} locale={ctx.locale} />;
    case "orbit_gallery":
      return (
        <OrbitGalleryElement props={props} workspaceId={ctx.workspaceId} currency={ctx.currency} locale={ctx.locale} />
      );
    case "scroll_story":
      return <ScrollStoryElement props={props} />;
    case "marquee":
      return <MarqueeElement props={props} />;
    case "comparison":
      return <ComparisonElement props={props} t={t} />;
    // --- SPEC §9.3 builder elements (builderElements.tsx) ---
    case "text_link":
      return <TextLinkElement props={props} />;
    case "tabs":
      return <TabsElement props={props} />;
    case "toggle":
      return <ToggleElement props={props} />;
    case "carousel":
      return <CarouselElement props={props} />;
    case "stars_display":
      return <StarsDisplayElement props={props} t={t} />;
    case "price":
      return <PriceElement props={props} workspaceId={ctx.workspaceId} currency={ctx.currency} locale={ctx.locale} />;
    case "reviews_list":
      return <ReviewsListElement props={props} workspaceId={ctx.workspaceId} t={t} locale={ctx.locale} />;
    case "cod_form":
      return <CodFormElement props={props} workspaceId={ctx.workspaceId} funnel={ctx.funnel} editable={ctx.editable} />;
    case "checkout_summary":
      return <CheckoutSummaryElement props={props} funnel={ctx.funnel} />;
    case "order_summary":
      return <OrderSummaryElement props={props} workspaceId={ctx.workspaceId} />;
    case "upsell_accept_button":
      return <UpsellActionElement props={props} action="accepted_offer" funnel={ctx.funnel} editable={ctx.editable} t={t} />;
    case "upsell_decline_link":
      return <UpsellActionElement props={props} action="declined_offer" funnel={ctx.funnel} editable={ctx.editable} t={t} />;
    case "repeater":
      return <RepeaterElement props={props} product={ctx.data?.product ?? null} t={t} />;
    default:
      // Pictures in columns of their own heights (item 93, ./builderMore).
      if ((element.type as string) === "masonry_grid") return <MasonryGridElement props={props} />;
      // Gallery with thumbnails, variant and bundle pickers, review form (./builderExtras).
      if (EXTRA_ELEMENT_TYPES.has(element.type)) {
        return <BuilderExtraElement type={element.type} props={props} workspaceId={ctx.workspaceId} editable={ctx.editable === true} />;
      }
      // The showcase sections (./showcase) draw their own types; anything
      // else is a type this renderer does not know, and a tree written for a
      // newer one must not blank the page — so it draws nothing.
      return (
        <ShowcaseElement
          type={element.type}
          props={props}
          ctx={{ workspaceId: ctx.workspaceId, currency: ctx.currency, locale: ctx.locale, editable: ctx.editable === true, eager: ctx.opening === true }}
        />
      );
  }
}

/**
 * Rows and columns carry the same kind of free-form `settings` as a section
 * (a column's card surface and alignment, a row's gap — see layout.ts), but
 * the api-client's types only declare it on sections and elements. Read it
 * off the node as the unknown it is; layout.ts checks the shape.
 */
function settingsOf(node: PageRow | PageColumn): unknown {
  return (node as { settings?: unknown }).settings;
}

/**
 * Markers for the editor's canvas only (components/preview). Both are read
 * off the element's marker, which exists in editable mode alone, so a
 * shopper's page never carries them.
 *
 * `data-zimos-image-field`: the prop that holds the element's one picture, so
 * "replace this picture" on the canvas knows where the new one goes. Left out
 * when the picture is bound to live data (the prop is not what shows).
 */
const EDITABLE_IMAGE_FIELD: Record<string, string> = { image: "src", image_banner: "image" };

function editableImageField(element: PageElement): string | undefined {
  const field = EDITABLE_IMAGE_FIELD[element.type as string];
  if (!field) return undefined;
  const bindings = (propsOf(element) as { bindings?: unknown }).bindings;
  const bound = bindings && typeof bindings === "object" ? (bindings as Record<string, unknown>)[field] : undefined;
  return bound ? undefined : field;
}

/**
 * `data-zimos-hidden`: the widths at which the element's own style hides it
 * from shoppers ("desktop tablet mobile", any of them; absent when none). The
 * canvas shows it there as a faded ghost instead, so it can still be picked.
 * Follows the stylesheet's cascade (elementStyle.ts): tablet falls back to
 * the base value, mobile to tablet's.
 */
function editableHiddenOn(element: PageElement): string | undefined {
  const style = (element.settings as { style?: unknown } | undefined)?.style;
  if (!style || typeof style !== "object" || Array.isArray(style)) return undefined;
  const flag = (device: string): boolean | undefined => {
    const block = (style as Record<string, unknown>)[device];
    const hidden = block && typeof block === "object" ? (block as { hidden?: unknown }).hidden : undefined;
    return typeof hidden === "boolean" ? hidden : undefined;
  };
  const desktop = flag("base") === true;
  const tablet = flag("tablet") ?? desktop;
  const mobile = flag("mobile") ?? tablet;
  const on = [desktop ? "desktop" : "", tablet ? "tablet" : "", mobile ? "mobile" : ""].filter(Boolean).join(" ");
  return on || undefined;
}

function ColumnNode({ column, ctx }: { column: PageColumn; ctx: Ctx }) {
  const span = Number.isInteger(column.span) ? Math.min(12, Math.max(1, column.span!)) : 12;
  const elements = Array.isArray(column.elements) ? column.elements : [];

  // `data-zt-col` / `data-zt-span` are store-theme hooks (globals.css); they
  // change nothing on a store without a theme.
  if (ctx.editable) {
    return (
      <div
        className={columnClasses(settingsOf(column), SPAN_CLASS[span])}
        data-zimos-column={column.id}
        data-zimos-span={span}
        data-zt-col=""
        data-zt-span={span}
      >
        {elements.map((element) => (
          <div
            key={element.id}
            data-zimos-el={element.id}
            data-zimos-type={element.type}
            data-zimos-image-field={editableImageField(element)}
            data-zimos-hidden={editableHiddenOn(element)}
            className="contents"
          >
            <StyledElement element={element} ctx={ctx} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={columnClasses(settingsOf(column), SPAN_CLASS[span])} data-zt-col="" data-zt-span={span}>
      {elements.map((element) => (
        <StyledElement key={element.id} element={element} ctx={ctx} />
      ))}
    </div>
  );
}

function RowNode({ row, ctx }: { row: PageRow; ctx: Ctx }) {
  const columns = Array.isArray(row.columns) ? row.columns : [];
  if (columns.length === 0) return null;

  return (
    <div className={rowClasses(settingsOf(row))} data-zimos-row={ctx.editable ? row.id : undefined}>
      {columns.map((column) => (
        <ColumnNode key={column.id} column={column} ctx={ctx} />
      ))}
    </div>
  );
}

/**
 * A section's optional `settings` — the small amount of look a section carries
 * itself, written by the editor's block presets and its section panel. The
 * class tables and their fallbacks live in layout.ts; a section without
 * settings gets exactly the classes it always had.
 */
function SectionNode({ section, ctx, hero = false }: { section: PageSection; ctx: Ctx; hero?: boolean }) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  if (rows.length === 0) return null;

  const { outer, inner } = sectionClasses(section.settings);
  const minHeight = sectionMinHeight(section.settings);

  // The hooks a store theme lays the section out by — its spacing, width and,
  // for the page's opening section, its own hero layout. Attributes only: a
  // store without a theme renders exactly the classes it always did.
  return (
    <section
      className={outer}
      style={minHeight === null ? undefined : { minHeight }}
      {...sectionHooks(section.settings)}
      data-zimos-hero={hero ? "" : undefined}
    >
      <div className={inner}>
        {rows.map((row) => (
          <RowNode key={row.id} row={row} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}

/**
 * A section as the website editor's canvas sees it: wrapped in a plain element
 * that names it, so the preview bridge (components/preview/PreviewBridge) can
 * outline it and report clicks to the editor. The wrapper has no styling of
 * its own, so the section inside looks exactly as it does to shoppers. A
 * section with no rows — which renders nothing at all on the store — gets a
 * visible empty slot here, or the merchant could never click it.
 */
function EditableSectionNode({
  section,
  index,
  ctx,
  hero,
}: {
  section: PageSection;
  index: number;
  ctx: Ctx;
  hero: boolean;
}) {
  const hasRows = Array.isArray(section.rows) && section.rows.length > 0;
  return (
    <div
      data-zimos-section={section.id}
      data-zimos-index={index}
      // The canvas ghosts a section marked hidden (settings.hidden) and offers "show" on its bar.
      data-zimos-hidden={(section.settings as { hidden?: unknown } | undefined)?.hidden === true ? "" : undefined}
    >
      {hasRows ? (
        <SectionNode section={section} ctx={ctx} hero={hero} />
      ) : (
        <div className="px-4 py-6 sm:px-6">
          <div className="mx-auto h-24 max-w-6xl rounded-[var(--radius-card)] border-2 border-dashed border-line" />
        </div>
      )}
    </div>
  );
}

export async function PageRenderer({
  tree,
  workspaceId,
  currency,
  locale,
  editable = false,
  funnel,
  siteStyles,
}: {
  tree: PageTree | null;
  workspaceId: string;
  currency: string;
  locale: Locale;
  /**
   * The website editor's preview only (app/store/[workspaceId]/preview): mark
   * every section so it can be selected from the canvas. Never set on a page
   * shoppers see, which renders exactly as it did before this existed.
   */
  editable?: boolean;
  /** A running funnel's step page — see PageRendererFunnel. */
  funnel?: PageRendererFunnel;
  /** The website's global styles: its named styles apply on every page (elementStyle.ts). */
  siteStyles?: unknown;
}) {
  const sections = Array.isArray(tree?.sections) ? tree.sections : [];
  if (sections.length === 0) return null;
  // The store's currency format, for the prices the elements below write on the server (lib/moneyFormat).
  setRequestMoneyFormat(((await getStoreMeta(workspaceId).catch(() => null)) as { currencyFormat?: MoneyFormat } | null)?.currencyFormat ?? null);
  const ctx: Ctx = {
    workspaceId,
    currency,
    locale,
    t: getDictionary(locale),
    funnel,
    editable,
    // One load for the whole page; null (and no call at all) when nothing is bound.
    data: await loadBindingData(tree, workspaceId, currency, locale),
    pageProductId: pageProductId(tree),
  };
  const hero = heroSectionIndex(sections);
  const opening = openingSectionIndex(sections);
  const openingCtx: Ctx = { ...ctx, opening: true };
  const css = pageStyleSheet(tree, siteStyles);

  // `zt-sections` lets a store theme restyle the rules between sections.
  return (
    <div className="zt-sections divide-y divide-line">
      {/* Built only from clamped numbers, keywords and hex colours — see elementStyle.ts. */}
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {sections.map((section, index) =>
        editable ? (
          <EditableSectionNode key={section.id} section={section} index={index} ctx={index === opening ? openingCtx : ctx} hero={index === hero} />
        ) : (
          <SectionNode key={section.id} section={section} ctx={index === opening ? openingCtx : ctx} hero={index === hero} />
        )
      )}
    </div>
  );
}
