import type {
  PageColumn,
  PageElement,
  PageRow,
  PageSection,
  PageTree,
} from "@store-builder/api-client";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";
import {
  CartElement,
  CollectionListElement,
  ProductCardElement,
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
import { SPAN_CLASS, propsOf } from "./props";

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
}

function ElementNode({ element, ctx }: { element: PageElement; ctx: Ctx }) {
  const props = propsOf(element);
  const { t } = ctx;

  switch (element.type) {
    case "heading":
      return <HeadingElement props={props} />;
    case "text":
      return <TextElement props={props} />;
    case "rich_text":
      return <TextElement props={props} large />;
    case "image":
      return <ImageElement props={props} />;
    case "gallery":
      return <GalleryElement props={props} />;
    case "button":
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
      return <FormElement props={props} t={t} />;
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
      return <CollectionListElement props={props} workspaceId={ctx.workspaceId} />;
    case "cart":
      // The cart is a way out of a funnel.
      return ctx.funnel ? null : <CartElement props={props} />;
    default:
      // Unreachable for the 23 allowed types, but a tree written before this
      // renderer knew about a new type must not blank the page.
      return null;
  }
}

function ColumnNode({ column, ctx }: { column: PageColumn; ctx: Ctx }) {
  const span = Number.isInteger(column.span) ? Math.min(12, Math.max(1, column.span!)) : 12;
  const elements = Array.isArray(column.elements) ? column.elements : [];

  return (
    <div className={`flex min-w-0 flex-col gap-4 ${SPAN_CLASS[span]}`}>
      {elements.map((element) => (
        <ElementNode key={element.id} element={element} ctx={ctx} />
      ))}
    </div>
  );
}

function RowNode({ row, ctx }: { row: PageRow; ctx: Ctx }) {
  const columns = Array.isArray(row.columns) ? row.columns : [];
  if (columns.length === 0) return null;

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {columns.map((column) => (
        <ColumnNode key={column.id} column={column} ctx={ctx} />
      ))}
    </div>
  );
}

function SectionNode({ section, ctx }: { section: PageSection; ctx: Ctx }) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  if (rows.length === 0) return null;

  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {rows.map((row) => (
          <RowNode key={row.id} row={row} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}

export function PageRenderer({
  tree,
  workspaceId,
  currency,
  locale,
  funnel,
}: {
  tree: PageTree | null;
  workspaceId: string;
  currency: string;
  locale: Locale;
  /** A running funnel's step page — see PageRendererFunnel. */
  funnel?: PageRendererFunnel;
}) {
  const sections = Array.isArray(tree?.sections) ? tree.sections : [];
  if (sections.length === 0) return null;
  const ctx: Ctx = { workspaceId, currency, locale, t: getDictionary(locale), funnel };

  return (
    <div className="divide-y divide-line">
      {sections.map((section) => (
        <SectionNode key={section.id} section={section} ctx={ctx} />
      ))}
    </div>
  );
}
