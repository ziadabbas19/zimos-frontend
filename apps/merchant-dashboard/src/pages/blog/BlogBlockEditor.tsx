import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconArrowDown, IconArrowUp, IconCaretDown, IconClick, IconDelete, IconDivider, IconHeading, IconImage, IconListView, IconPackage, IconParagraph, IconPlus, IconQuote, IconSearch } from "@/components/icons";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, cn, ZLoader } from "@store-builder/ui";
import { ApiError, BLOG_BLOCKS_MAX, BLOG_BLOCK_TYPES, type BlogBlockType, type ProductListParams } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { FilterTabs } from "@/components/FilterTabs";
import { DESIGNER_STRINGS, ImageSource } from "@/pages/settings/EmailBlockDesigner";
import { blockProblems, listItems, newBlock, type BlockProblem, type BlockProblems, type DraftBlock } from "./blogDraft";

/**
 * The post's body as a stack of blocks: heading,
 * paragraph, image, list, quote, product, button, divider. Built for a phone
 * the way the email designer is (settings/EmailBlockDesigner.tsx): one column,
 * each block a card that opens its own form, up/down to reorder, "Add block"
 * at the end. The storefront draws the blocks as text — no HTML.
 */

const STRINGS = {
  en: {
    addBlock: "Add block",
    heading: "Heading",
    paragraph: "Paragraph",
    image: "Image",
    list: "List",
    quote: "Quote",
    product: "Product",
    button: "Button",
    divider: "Divider",
    moveUp: "Move “{name}” up",
    moveDown: "Move “{name}” down",
    remove: "Delete “{name}”",
    toggle: "Edit “{name}”",
    needsFix: "Needs filling in",
    empty: "(empty)",
    headingText: "Heading text",
    size: "Size",
    large: "Large",
    small: "Small",
    paragraphText: "Text",
    paragraphHint: "Shown exactly as written. For a new paragraph, add another paragraph block.",
    imageSource: "Image",
    alt: "Image description (for screen readers and Google)",
    caption: "Caption under the image",
    optional: "Optional",
    items: "Items — one per line",
    itemsHint: "Up to 50 items.",
    ordered: "Numbered list (1, 2, 3)",
    quoteText: "Quote",
    cite: "Who said it",
    productPick: "Product",
    productSearch: "Search products",
    productNone: "Pick a product",
    productLoading: "Loading products…",
    productFailed: "We couldn't load your products. Try again in a moment.",
    productNoMatch: "No product matches.",
    productUnknown: "A product that isn't in your store anymore",
    productOff: "{name} — not on sale now",
    productNote: "Shows with its picture, its price today and an add-to-cart button. If it stops selling, it disappears from the post.",
    buttonLabel: "Button text",
    buttonLink: "Link",
    buttonLinkHint: "A page of your store like /products, or a full link starting with https://",
    dividerNote: "A thin line between parts of the post.",
    emptyTitle: "No blocks yet",
    emptyBody: "Start with a paragraph, then add headings, pictures and products as you go.",
    maxReached: "A post holds up to 200 blocks.",
    p_required: "Fill this in.",
    p_tooLong: "This is too long.",
    p_imageUrl: "Use an image link starting with https://, or pick one from your library.",
    p_link: "Use a page of your store starting with /, or a link starting with https://",
    p_product: "Pick a product.",
    p_tooMany: "A list holds up to 50 items.",
    p_server: "Check this.",
  },
  ar: {
    addBlock: "إضافة عنصر",
    heading: "عنوان",
    paragraph: "فقرة",
    image: "صورة",
    list: "قائمة",
    quote: "اقتباس",
    product: "منتج",
    button: "زر",
    divider: "فاصل",
    moveUp: "نقل «{name}» إلى الأعلى",
    moveDown: "نقل «{name}» إلى الأسفل",
    remove: "حذف «{name}»",
    toggle: "تعديل «{name}»",
    needsFix: "يحتاج إلى استكمال",
    empty: "(فارغ)",
    headingText: "نص العنوان",
    size: "الحجم",
    large: "كبير",
    small: "صغير",
    paragraphText: "النص",
    paragraphHint: "يظهر كما كتبته تمامًا. لفقرة جديدة أضف عنصر فقرة آخر.",
    imageSource: "الصورة",
    alt: "وصف الصورة (لقارئات الشاشة وجوجل)",
    caption: "تعليق تحت الصورة",
    optional: "اختياري",
    items: "العناصر — كل عنصر في سطر",
    itemsHint: "حتى ٥٠ عنصرًا.",
    ordered: "قائمة مرقّمة (١، ٢، ٣)",
    quoteText: "الاقتباس",
    cite: "صاحب الاقتباس",
    productPick: "المنتج",
    productSearch: "ابحث عن منتج",
    productNone: "اختر منتجًا",
    productLoading: "جارٍ تحميل المنتجات…",
    productFailed: "تعذّر تحميل منتجاتك. حاول مرة أخرى بعد قليل.",
    productNoMatch: "لا يوجد منتج بهذا الاسم.",
    productUnknown: "منتج لم يعد في متجرك",
    productOff: "{name} — غير معروض للبيع الآن",
    productNote: "يظهر بصورته وسعره الحالي وزر الإضافة إلى السلة. إذا توقف بيع المنتج اختفى من المقال.",
    buttonLabel: "نص الزر",
    buttonLink: "الرابط",
    buttonLinkHint: "صفحة في متجرك مثل ‎/products، أو رابط كامل يبدأ بـ https://",
    dividerNote: "خط رفيع بين أجزاء المقال.",
    emptyTitle: "لا توجد عناصر بعد",
    emptyBody: "ابدأ بفقرة، ثم أضف العناوين والصور والمنتجات تباعًا.",
    maxReached: "يتسع المقال لـ ٢٠٠ عنصر على الأكثر.",
    p_required: "املأ هذا الحقل.",
    p_tooLong: "هذا النص أطول من اللازم.",
    p_imageUrl: "استخدم رابط صورة يبدأ بـ https://، أو اختر صورة من المكتبة.",
    p_link: "استخدم صفحة في متجرك تبدأ بـ /، أو رابطًا يبدأ بـ https://",
    p_product: "اختر منتجًا.",
    p_tooMany: "تتسع القائمة لـ ٥٠ عنصرًا على الأكثر.",
    p_server: "راجع هذا الحقل.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

const BLOCK_ICON: Record<BlogBlockType, typeof IconHeading> = {
  heading: IconHeading,
  paragraph: IconParagraph,
  image: IconImage,
  list: IconListView,
  quote: IconQuote,
  product: IconPackage,
  button: IconClick,
  divider: IconDivider,
};

const problemText = (t: T, p: BlockProblem | undefined) => (p ? t[`p_${p}`] : undefined);

/** What a closed card says about its block. */
function summaryOf(t: T, b: DraftBlock, productName: (id: string) => string | null): string {
  if (b.type === "heading" || b.type === "paragraph" || b.type === "quote") return b.text.trim().split("\n")[0] || t.empty;
  if (b.type === "image") return b.caption.trim() || b.alt.trim() || b.url.trim().split("/").pop() || t.empty;
  if (b.type === "list") return listItems(b).join(" · ") || t.empty;
  if (b.type === "product") return b.productId ? (productName(b.productId) ?? "…") : t.empty;
  if (b.type === "button") return b.label.trim() || t.empty;
  return t.dividerNote;
}

interface ProductOption {
  id: string;
  name: string;
}

/** A product block's product as the editor knows it; name null: deleted from the store. */
interface ProductName {
  name: string | null;
  onSale: boolean;
}

export function BlogBlockEditor({
  blocks,
  onChange,
  openId,
  onOpen,
  revealProblems,
  serverProblems,
  disabled,
}: {
  blocks: DraftBlock[];
  onChange: (blocks: DraftBlock[]) => void;
  openId: string | null;
  onOpen: (id: string | null) => void;
  /** After a save attempt every unfinished field says what it needs. */
  revealProblems: boolean;
  /** Fields the server refused, by block id. */
  serverProblems: Record<string, BlockProblems>;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const full = blocks.length >= BLOG_BLOCKS_MAX;

  // Names for the product blocks, each product read once by its id (a big catalogue needs no full list).
  // A product deleted since (404) or no longer on sale is named as such: the store leaves it out of the post.
  const [names, setNames] = useState<Record<string, ProductName>>({});
  const unnamed = [...new Set(blocks.flatMap((b) => (b.type === "product" && b.productId ? [b.productId] : [])))]
    .filter((id) => !(id in names))
    .join(",");
  useEffect(() => {
    if (!unnamed) return;
    let live = true;
    void Promise.all(
      unnamed.split(",").map(async (id): Promise<[string, ProductName] | null> => {
        try {
          const product = await apiClient.getProduct(workspaceId, id);
          return [id, { name: product.name, onSale: product.status === "active" }];
        } catch (err) {
          // Only a missing product is "gone"; any other failure leaves the card unnamed.
          return err instanceof ApiError && err.status === 404 ? [id, { name: null, onSale: false }] : null;
        }
      })
    ).then((found) => {
      if (live) setNames((prev) => ({ ...prev, ...Object.fromEntries(found.filter((x) => x !== null)) }));
    });
    return () => {
      live = false;
    };
  }, [unnamed, workspaceId]);
  const productName = (id: string): string | null => {
    const known = names[id];
    if (!known) return null;
    if (!known.name) return t.productUnknown;
    return known.onSale ? known.name : fmt(t.productOff, { name: known.name });
  };

  const update = (id: string, patch: Partial<DraftBlock>) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = blocks.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  };
  const remove = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
    if (openId === id) onOpen(null);
  };
  const add = (type: BlogBlockType) => {
    if (full) return;
    const block = newBlock(type);
    onChange([...blocks, block]);
    onOpen(type === "divider" ? null : block.id);
    // The new card is at the end of the list: bring it into view once drawn.
    window.requestAnimationFrame(() => document.getElementById(`blog-block-${block.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  return (
    <div className="space-y-2">
      {blocks.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-paper-raised px-4 py-6 text-center">
          <p className="text-sm font-medium text-ink">{t.emptyTitle}</p>
          <p className="mt-1 text-xs text-ink-soft">{t.emptyBody}</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {blocks.map((block, index) => (
            <BlockCard
              key={block.id}
              t={t}
              block={block}
              index={index}
              count={blocks.length}
              open={openId === block.id}
              revealProblems={revealProblems}
              serverProblems={serverProblems[block.id]}
              productName={productName}
              onPicked={(p) => setNames((prev) => ({ ...prev, [p.id]: { name: p.name, onSale: true } }))}
              disabled={disabled}
              onToggle={() => onOpen(openId === block.id ? null : block.id)}
              onChange={(patch) => update(block.id, patch)}
              onMove={(delta) => move(index, delta)}
              onRemove={() => remove(block.id)}
            />
          ))}
        </ol>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={full || disabled}
          render={<Button type="button" variant="outline" className="min-h-11 w-full border-dashed sm:min-h-10" />}
        >
          <IconPlus className="size-4" aria-hidden />
          {t.addBlock}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-56">
          {BLOG_BLOCK_TYPES.map((type) => {
            const Icon = BLOCK_ICON[type];
            return (
              <DropdownMenuItem key={type} onClick={() => add(type)} className="min-h-11 gap-2 sm:min-h-9">
                <Icon className="size-4 text-ink-soft" aria-hidden />
                {t[type]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {full && <p className="text-xs text-ink-soft">{t.maxReached}</p>}
    </div>
  );
}

function BlockCard({
  t,
  block,
  index,
  count,
  open,
  revealProblems,
  serverProblems,
  productName,
  onPicked,
  disabled,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: {
  t: T;
  block: DraftBlock;
  index: number;
  count: number;
  open: boolean;
  revealProblems: boolean;
  serverProblems: BlockProblems | undefined;
  productName: (id: string) => string | null;
  onPicked: (product: ProductOption) => void;
  disabled?: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftBlock>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const designer = useT(DESIGNER_STRINGS);
  const Icon = BLOCK_ICON[block.type];
  const name = t[block.type];
  const own = blockProblems(block);
  const shown: BlockProblems = { ...(serverProblems ?? {}), ...(revealProblems ? own : {}) };
  const flagged = Object.keys(shown).length > 0;
  const hasForm = block.type !== "divider";
  const formId = `blog-block-form-${block.id}`;

  return (
    <li
      id={`blog-block-${block.id}`}
      className={cn(
        "scroll-mt-4 rounded-[var(--radius-card)] bg-paper-raised ring-1 transition-shadow",
        flagged ? "ring-danger" : open ? "ring-primary shadow-[var(--shadow-card)]" : "ring-line"
      )}
    >
      <div className="flex items-center gap-1 p-1.5 ps-3">
        <button
          type="button"
          onClick={hasForm ? onToggle : undefined}
          aria-expanded={hasForm ? open : undefined}
          aria-controls={hasForm ? formId : undefined}
          aria-label={hasForm ? fmt(t.toggle, { name }) : undefined}
          className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-start", hasForm ? "cursor-pointer" : "cursor-default")}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] bg-paper-sunken text-ink-soft">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              {name}
              {flagged && <span className="text-xs font-normal text-danger">· {t.needsFix}</span>}
            </span>
            <span className="block truncate text-xs text-ink-soft" dir="auto">
              {summaryOf(t, block, productName)}
            </span>
          </span>
          {hasForm && (
            <IconCaretDown className={cn("size-4 shrink-0 text-ink-soft transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
          )}
        </button>
        <IconAction label={fmt(t.moveUp, { name })} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
          <IconArrowUp className="size-4" aria-hidden />
        </IconAction>
        <IconAction label={fmt(t.moveDown, { name })} disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
          <IconArrowDown className="size-4" aria-hidden />
        </IconAction>
        <IconAction label={fmt(t.remove, { name })} danger disabled={disabled} onClick={onRemove}>
          <IconDelete className="size-4" aria-hidden />
        </IconAction>
      </div>

      {hasForm && open && (
        <div id={formId} className="space-y-4 border-t border-line p-3 sm:p-4">
          {block.type === "heading" && (
            <>
              <Field label={t.headingText} error={problemText(t, shown.text)}>
                {({ id, ...aria }) => (
                  <Input id={id} {...aria} dir="auto" maxLength={300} value={block.text} onChange={(e) => onChange({ text: e.target.value })} />
                )}
              </Field>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">{t.size}</p>
                <FilterTabs
                  label={t.size}
                  value={String(block.level) as "2" | "3"}
                  onChange={(v) => onChange({ level: v === "3" ? 3 : 2 })}
                  tabs={[
                    { value: "2", label: t.large },
                    { value: "3", label: t.small },
                  ]}
                  buttonClassName="min-h-10"
                />
              </div>
            </>
          )}

          {block.type === "paragraph" && (
            <Field label={t.paragraphText} hint={t.paragraphHint} error={problemText(t, shown.text)}>
              {({ id, ...aria }) => (
                <Textarea id={id} {...aria} dir="auto" rows={6} maxLength={10000} value={block.text} onChange={(e) => onChange({ text: e.target.value })} />
              )}
            </Field>
          )}

          {block.type === "image" && (
            <>
              <ImageSource
                t={{ ...designer, imageSource: t.imageSource }}
                value={block.url}
                error={problemText(t, shown.url)}
                onChange={(url) => onChange({ url })}
              />
              <Field label={t.alt} error={problemText(t, shown.alt)}>
                {({ id, ...aria }) => <Input id={id} {...aria} dir="auto" maxLength={200} value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} />}
              </Field>
              <Field label={t.caption} hint={t.optional} error={problemText(t, shown.caption)}>
                {({ id, ...aria }) => (
                  <Input id={id} {...aria} dir="auto" maxLength={300} value={block.caption} onChange={(e) => onChange({ caption: e.target.value })} />
                )}
              </Field>
            </>
          )}

          {block.type === "list" && (
            <>
              <Field label={t.items} hint={t.itemsHint} error={problemText(t, shown.items)}>
                {({ id, ...aria }) => <Textarea id={id} {...aria} dir="auto" rows={5} value={block.items} onChange={(e) => onChange({ items: e.target.value })} />}
              </Field>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="size-4 accent-primary" checked={block.ordered} onChange={(e) => onChange({ ordered: e.target.checked })} />
                {t.ordered}
              </label>
            </>
          )}

          {block.type === "quote" && (
            <>
              <Field label={t.quoteText} error={problemText(t, shown.text)}>
                {({ id, ...aria }) => <Textarea id={id} {...aria} dir="auto" rows={3} maxLength={10000} value={block.text} onChange={(e) => onChange({ text: e.target.value })} />}
              </Field>
              <Field label={t.cite} hint={t.optional} error={problemText(t, shown.cite)}>
                {({ id, ...aria }) => <Input id={id} {...aria} dir="auto" maxLength={200} value={block.cite} onChange={(e) => onChange({ cite: e.target.value })} />}
              </Field>
            </>
          )}

          {block.type === "product" && (
            <ProductField
              t={t}
              value={block.productId}
              currentName={block.productId ? productName(block.productId) : null}
              error={problemText(t, shown.productId)}
              onChange={(product) => {
                onChange({ productId: product?.id ?? "" });
                if (product) onPicked(product);
              }}
            />
          )}

          {block.type === "button" && (
            <>
              <Field label={t.buttonLabel} error={problemText(t, shown.label)}>
                {({ id, ...aria }) => <Input id={id} {...aria} dir="auto" maxLength={80} value={block.label} onChange={(e) => onChange({ label: e.target.value })} />}
              </Field>
              <Field label={t.buttonLink} hint={t.buttonLinkHint} error={problemText(t, shown.url)}>
                {({ id, ...aria }) => (
                  <Input
                    id={id}
                    {...aria}
                    dir="ltr"
                    inputMode="url"
                    placeholder="/products"
                    maxLength={1000}
                    value={block.url}
                    onChange={(e) => onChange({ url: e.target.value })}
                  />
                )}
              </Field>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function IconAction({ label, disabled, danger, onClick, children }: { label: string; disabled?: boolean; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius)] text-ink-soft transition-colors disabled:cursor-not-allowed disabled:opacity-35 sm:size-9",
        "focus-visible:outline-2 focus-visible:outline-primary",
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-paper-sunken hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/** One of the store's products on sale: a search, then a pick. */
function ProductField({
  t,
  value,
  currentName,
  error,
  onChange,
}: {
  t: T;
  value: string;
  currentName: string | null;
  error?: string;
  onChange: (product: ProductOption | null) => void;
}) {
  const workspaceId = useWorkspaceId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Only products on sale: the store drops any other from the post.
  const list = useAsync<ProductOption[]>(async () => {
    // The catalogue's name / SKU search (q) is not in ProductListParams; the client passes it through.
    const params: ProductListParams & { q?: string } = { limit: 50, status: ["active"], q: debounced || undefined };
    const { products } = await apiClient.listProducts(workspaceId, params);
    return products.map((p) => ({ id: p.id, name: p.name }));
  }, [workspaceId, debounced]);

  const options = useMemo(() => {
    const rows = list.data ?? [];
    // The picked product, also while its name loads or when it is no longer on sale.
    if (value && !rows.some((o) => o.id === value)) return [{ id: value, name: currentName ?? "…" }, ...rows];
    return rows;
  }, [list.data, value, currentName]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.productSearch} aria-label={t.productSearch} className="ps-9" />
      </div>
      <Field label={t.productPick} hint={t.productNote} error={error}>
        {({ id, ...aria }) => (
          <Select
            id={id}
            {...aria}
            value={value}
            onChange={(e) => {
              const picked = options.find((o) => o.id === e.target.value) ?? null;
              onChange(picked);
            }}
          >
            <option value="">{t.productNone}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {list.loading && !list.data && <ZLoader size="sm" label={t.productLoading} />}
      {Boolean(list.error) && <p className="text-xs text-danger">{t.productFailed}</p>}
      {list.data && list.data.length === 0 && debounced && <p className="text-xs text-ink-soft">{t.productNoMatch}</p>}
    </div>
  );
}
