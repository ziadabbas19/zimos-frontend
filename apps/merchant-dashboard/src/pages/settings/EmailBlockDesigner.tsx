import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconArrowDown, IconArrowUp, IconCaretDown, IconClick, IconDelete, IconDivider, IconHeading, IconImage, IconMedia, IconParagraph, IconPlus, IconTable } from "@/components/icons";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Label, cn, ZLoader } from "@store-builder/ui";
import { EMAIL_BLOCKS_MAX, type EmailBlockType, type MediaAsset } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { imageSrc } from "@/lib/media";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { FilterTabs } from "@/components/FilterTabs";
import { ImageUrlInput } from "@/pages/catalog/components/ImageUrlInput";
import { blockProblems, insertToken, linkTokens, newBlock, type BlockProblem, type BlockProblems, type DraftBlock } from "./emailBlocks";

/**
 * The block designer: the email as a stack of blocks —
 * heading, text, button, image, order table, divider. Built for a phone:
 * one column, each block a card that opens its own form, up/down buttons to
 * reorder, an "Add block" menu at the end. The server renders the blocks
 * (backend notifications/emailBlocks.js); OrderEmailEditor.tsx previews them.
 */

export const DESIGNER_STRINGS = {
  en: {
    addBlock: "Add block",
    heading: "Heading",
    text: "Text",
    button: "Button",
    image: "Image",
    order_table: "Order table",
    divider: "Divider",
    moveUp: "Move “{name}” up",
    moveDown: "Move “{name}” down",
    remove: "Delete “{name}”",
    toggle: "Edit “{name}”",
    needsFix: "Needs filling in",
    empty: "(empty)",
    size: "Size",
    large: "Large",
    medium: "Medium",
    align: "Alignment",
    right: "Right",
    center: "Center",
    left: "Left",
    headingText: "Heading text",
    bodyText: "Text",
    textHint: "A blank line starts a new paragraph.",
    insert: "Insert a detail:",
    buttonLabel: "Button text",
    buttonLink: "Button link",
    link_order_link: "Order page",
    link_recovery_link: "Finish-the-order link (cart recovery)",
    link_tracking_url: "Tracking link",
    link_confirm_link: "Order confirmation link",
    link_review_link: "Review link",
    link_payment_link: "Payment link",
    link_subscription_link: "Subscription page",
    customLink: "Another link (https://…)",
    linkAddress: "Link",
    color: "Button colour",
    colorPicker: "Choose the button colour",
    storeColor: "The store's colour",
    useStoreColor: "Use the store's colour",
    imageSource: "Image",
    fromLibrary: "Choose from your library",
    hideLibrary: "Hide library",
    libraryEmpty: "No images in your library yet. Upload one above.",
    libraryPick: "Use image {n}",
    loadMore: "More images",
    alt: "Image description (for screen readers)",
    imageLink: "Link when tapped",
    noLink: "No link",
    width: "Width in px (40–600)",
    widthHint: "Empty: the email's full width.",
    orderTableNote: "The order's products × quantity, with shipping and total. In the cart-recovery email: the cart's products.",
    dividerNote: "A thin line between parts of the email.",
    emptyTitle: "No blocks yet",
    emptyBody: "Start with a heading, a text and the order table.",
    maxReached: "An email holds up to 40 blocks.",
    p_required: "Fill this in.",
    p_tooLong: "This is too long.",
    p_link: "Use a link starting with https:// or a link variable such as order_link.",
    p_imageUrl: "Use an image link starting with https://, or upload one.",
    p_color: "Pick a colour like #2563EB.",
    p_width: "Use a whole number from 40 to 600.",
  },
  ar: {
    addBlock: "إضافة عنصر",
    heading: "عنوان",
    text: "نص",
    button: "زر",
    image: "صورة",
    order_table: "جدول الطلب",
    divider: "فاصل",
    moveUp: "نقل «{name}» إلى الأعلى",
    moveDown: "نقل «{name}» إلى الأسفل",
    remove: "حذف «{name}»",
    toggle: "تعديل «{name}»",
    needsFix: "يحتاج إلى استكمال",
    empty: "(فارغ)",
    size: "الحجم",
    large: "كبير",
    medium: "متوسط",
    align: "المحاذاة",
    right: "يمين",
    center: "وسط",
    left: "يسار",
    headingText: "نص العنوان",
    bodyText: "النص",
    textHint: "السطر الفارغ يبدأ فقرة جديدة.",
    insert: "إدراج متغير:",
    buttonLabel: "نص الزر",
    buttonLink: "رابط الزر",
    link_order_link: "صفحة الطلب",
    link_recovery_link: "رابط إكمال الطلب (السلة المتروكة)",
    link_tracking_url: "رابط التتبع",
    link_confirm_link: "رابط تأكيد الطلب",
    link_review_link: "رابط التقييم",
    link_payment_link: "رابط الدفع",
    link_subscription_link: "صفحة الاشتراك",
    customLink: "رابط آخر (https://…)",
    linkAddress: "الرابط",
    color: "لون الزر",
    colorPicker: "اختيار لون الزر",
    storeColor: "لون المتجر",
    useStoreColor: "استخدام لون المتجر",
    imageSource: "الصورة",
    fromLibrary: "اختيار من مكتبة الصور",
    hideLibrary: "إخفاء المكتبة",
    libraryEmpty: "لا توجد صور في المكتبة بعد. ارفع صورة من الأعلى.",
    libraryPick: "استخدام الصورة {n}",
    loadMore: "صور أكثر",
    alt: "وصف الصورة (لقارئات الشاشة)",
    imageLink: "رابط يُفتح عند الضغط عليها",
    noLink: "بدون رابط",
    width: "العرض بالبكسل (٤٠–٦٠٠)",
    widthHint: "فارغ: بعرض الرسالة كاملًا.",
    orderTableNote: "منتجات الطلب × الكمية، مع الشحن والإجمالي. في رسالة السلة المتروكة: منتجات السلة.",
    dividerNote: "خط رفيع بين أجزاء الرسالة.",
    emptyTitle: "لا توجد عناصر بعد",
    emptyBody: "ابدأ بعنوان ونص وجدول الطلب.",
    maxReached: "تتسع الرسالة لـ ٤٠ عنصرًا على الأكثر.",
    p_required: "املأ هذا الحقل.",
    p_tooLong: "هذا النص أطول من اللازم.",
    p_link: "استخدم رابطًا يبدأ بـ https:// أو متغير رابط مثل order_link.",
    p_imageUrl: "استخدم رابط صورة يبدأ بـ https:// أو ارفع صورة.",
    p_color: "اختر لونًا مثل ‎#2563EB.",
    p_width: "اكتب رقمًا صحيحًا من ٤٠ إلى ٦٠٠.",
  },
} satisfies Messages;

type T = Record<keyof (typeof DESIGNER_STRINGS)["en"], string>;

export const BLOCK_TYPES: EmailBlockType[] = ["heading", "text", "button", "image", "order_table", "divider"];

const BLOCK_ICON: Record<EmailBlockType, typeof IconHeading> = {
  heading: IconHeading,
  text: IconParagraph,
  button: IconClick,
  image: IconImage,
  order_table: IconTable,
  divider: IconDivider,
};

const problemText = (t: T, p: BlockProblem | undefined) => (p ? (t as Record<string, string>)[`p_${p}`] : undefined);

/** What a closed card says about its block. */
function summaryOf(t: T, b: DraftBlock): string {
  if (b.type === "heading" || b.type === "text") return b.text.trim().split("\n")[0] || t.empty;
  if (b.type === "button") return b.label.trim() || t.empty;
  if (b.type === "image") return b.alt.trim() || b.url.trim().split("/").pop() || t.empty;
  if (b.type === "order_table") return t.orderTableNote;
  return t.dividerNote;
}

export function EmailBlockDesigner({
  blocks,
  onChange,
  tokens,
  openId,
  onOpen,
  revealProblems,
  defaultButtonLink,
}: {
  blocks: DraftBlock[];
  onChange: (blocks: DraftBlock[]) => void;
  tokens: string[];
  /** The block whose form is open. */
  openId: string | null;
  onOpen: (id: string | null) => void;
  /** After a save or test attempt every unfinished field says what it needs. */
  revealProblems: boolean;
  /** Where a new button points, e.g. {{recovery_link}} in the cart-recovery email. */
  defaultButtonLink: string;
}) {
  const t = useT(DESIGNER_STRINGS);
  const full = blocks.length >= EMAIL_BLOCKS_MAX;

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
  const add = (type: EmailBlockType) => {
    if (full) return;
    const block = newBlock(type, type === "button" ? { url: defaultButtonLink } : {});
    onChange([...blocks, block]);
    onOpen(type === "order_table" || type === "divider" ? null : block.id);
    // The new card is at the end of the list: bring it into view once drawn.
    window.requestAnimationFrame(() => document.getElementById(`email-block-${block.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
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
              tokens={tokens}
              revealProblems={revealProblems}
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
          disabled={full}
          render={
            <Button type="button" variant="outline" className="min-h-11 w-full border-dashed sm:min-h-10" />
          }
        >
          <IconPlus className="size-4" aria-hidden />
          {t.addBlock}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-56">
          {BLOCK_TYPES.map((type) => {
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
  tokens,
  revealProblems,
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
  tokens: string[];
  revealProblems: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftBlock>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const Icon = BLOCK_ICON[block.type];
  const name = t[block.type];
  const problems = blockProblems(block);
  const flagged = revealProblems && Object.keys(problems).length > 0;
  const shown: BlockProblems = revealProblems ? problems : {};
  const hasForm = block.type !== "order_table" && block.type !== "divider";
  const formId = `email-block-form-${block.id}`;

  return (
    <li
      id={`email-block-${block.id}`}
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
              {summaryOf(t, block)}
            </span>
          </span>
          {hasForm && <IconCaretDown className={cn("size-4 shrink-0 text-ink-soft transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />}
        </button>
        <IconAction label={fmt(t.moveUp, { name })} disabled={index === 0} onClick={() => onMove(-1)}>
          <IconArrowUp className="size-4" aria-hidden />
        </IconAction>
        <IconAction label={fmt(t.moveDown, { name })} disabled={index === count - 1} onClick={() => onMove(1)}>
          <IconArrowDown className="size-4" aria-hidden />
        </IconAction>
        <IconAction label={fmt(t.remove, { name })} danger onClick={onRemove}>
          <IconDelete className="size-4" aria-hidden />
        </IconAction>
      </div>

      {hasForm && open && (
        <div id={formId} className="space-y-4 border-t border-line p-3 sm:p-4">
          {block.type === "heading" && (
            <>
              <TokenField t={t} label={t.headingText} value={block.text} tokens={tokens} error={problemText(t, shown.text)} onChange={(text) => onChange({ text })} />
              <div className="flex flex-wrap gap-x-6 gap-y-4">
                <Choice
                  label={t.size}
                  value={block.size}
                  options={[
                    { value: "lg", label: t.large },
                    { value: "md", label: t.medium },
                  ]}
                  onChange={(size) => onChange({ size })}
                />
                <AlignChoice t={t} value={block.align} onChange={(align) => onChange({ align })} />
              </div>
            </>
          )}

          {block.type === "text" && (
            <>
              <TokenField
                t={t}
                multiline
                label={t.bodyText}
                hint={t.textHint}
                value={block.text}
                tokens={tokens}
                error={problemText(t, shown.text)}
                onChange={(text) => onChange({ text })}
              />
              <AlignChoice t={t} value={block.align} onChange={(align) => onChange({ align })} />
            </>
          )}

          {block.type === "button" && (
            <>
              <TokenField t={t} label={t.buttonLabel} value={block.label} tokens={[]} maxLength={80} error={problemText(t, shown.label)} onChange={(label) => onChange({ label })} />
              <LinkField t={t} label={t.buttonLink} value={block.url} tokens={tokens} required error={problemText(t, shown.url)} onChange={(url) => onChange({ url })} />
              <ButtonColor t={t} value={block.color} error={problemText(t, shown.color)} onChange={(color) => onChange({ color })} />
              <AlignChoice t={t} value={block.align} onChange={(align) => onChange({ align })} />
            </>
          )}

          {block.type === "image" && (
            <>
              <ImageSource t={t} value={block.url} error={problemText(t, shown.url)} onChange={(url) => onChange({ url })} />
              <Field label={t.alt} error={problemText(t, shown.alt)}>
                {({ id, ...aria }) => <Input id={id} {...aria} dir="auto" maxLength={200} value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} />}
              </Field>
              <LinkField t={t} label={t.imageLink} value={block.link} tokens={tokens} error={problemText(t, shown.link)} onChange={(link) => onChange({ link })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.width} hint={t.widthHint} error={problemText(t, shown.width)}>
                  {({ id, ...aria }) => (
                    <Input
                      id={id}
                      {...aria}
                      type="number"
                      inputMode="numeric"
                      dir="ltr"
                      min={40}
                      max={600}
                      step={1}
                      value={block.width}
                      onChange={(e) => onChange({ width: e.target.value })}
                    />
                  )}
                </Field>
                <AlignChoice t={t} value={block.align} onChange={(align) => onChange({ align })} />
              </div>
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

function Choice<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink">{label}</p>
      <FilterTabs label={label} value={value} onChange={onChange} tabs={options} className="[&>button]:min-h-10" />
    </div>
  );
}

/** The email is right to left, so "start" is its right edge. */
function AlignChoice({ t, value, onChange }: { t: T; value: DraftBlock["align"]; onChange: (v: DraftBlock["align"]) => void }) {
  return (
    <Choice
      label={t.align}
      value={value || "start"}
      options={[
        { value: "start", label: t.right },
        { value: "center", label: t.center },
        { value: "end", label: t.left },
      ]}
      onChange={(v) => onChange(v === "start" ? "" : v)}
    />
  );
}

/** A text field with the {{variable}} chips under it; a chip goes in where the caret was. */
export function TokenField({
  t,
  label,
  hint,
  value,
  tokens,
  error,
  multiline,
  maxLength = 5000,
  dir = "auto",
  onChange,
}: {
  /** The box's direction; by what is typed unless the caller knows the language. */
  dir?: "auto" | "rtl" | "ltr";
  t: { insert: string };
  label: string;
  hint?: string;
  value: string;
  tokens: string[];
  error?: string;
  multiline?: boolean;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const caret = useRef<{ start: number; end: number } | null>(null);
  const [active, setActive] = useState(false);
  const remember = () => {
    const el = ref.current;
    if (el) caret.current = { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length };
  };
  const pick = (token: string) => {
    const next = insertToken(value, token, caret.current);
    onChange(next.value);
    caret.current = { start: next.caret, end: next.caret };
    window.requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(next.caret, next.caret);
    });
  };
  const common = {
    ref,
    dir,
    value,
    maxLength,
    onSelect: remember,
    onKeyUp: remember,
    onBlur: remember,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  // The chips show while the field (or a chip) has focus, so a form of
  // several fields does not stack several rows of them.
  return (
    <div
      className="space-y-1.5"
      onFocus={() => setActive(true)}
      onBlur={(ev) => {
        if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setActive(false);
      }}
    >
      <Field label={label} hint={hint} error={error}>
        {({ id, ...aria }) => (multiline ? <Textarea id={id} {...aria} rows={5} {...common} /> : <Input id={id} {...aria} {...common} />)}
      </Field>
      {active && tokens.length > 0 && <TokenChips label={t.insert} tokens={tokens} onPick={pick} />}
    </div>
  );
}

/** The {{variable}} chips: one row that scrolls sideways on a phone, wrapped on wider screens. */
export function TokenChips({ label, tokens, onPick }: { label: string; tokens: string[]; onPick: (token: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="shrink-0 text-ink-soft">{label}</span>
      <div className="-my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 sm:flex-wrap sm:overflow-visible">
        {tokens.map((token) => (
          <button
            key={token}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(token)}
            dir="ltr"
            className="min-h-11 shrink-0 cursor-pointer rounded-full border border-line bg-paper px-2.5 font-mono text-ink-soft hover:border-primary hover:text-primary sm:min-h-7"
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A link: one of the email's link variables, or the merchant's own https:// address. */
function LinkField({
  t,
  label,
  value,
  tokens,
  required,
  error,
  onChange,
}: {
  t: T;
  label: string;
  value: string;
  tokens: string[];
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const vars = linkTokens(tokens);
  const match = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(value.trim());
  const variable = match && vars.includes(match[1]!) ? match[1]! : null;
  const [custom, setCustom] = useState(() => Boolean(value) && !variable);
  const selected = custom ? "__custom" : variable ?? (required ? "__custom" : "");
  const inputId = useId();
  const linkLabel = (v: string) => (t as Record<string, string>)[`link_${v}`] ?? v;

  return (
    <div className="space-y-2">
      <Field label={label} error={selected === "__custom" ? undefined : error}>
        {({ id, ...aria }) => (
          <Select
            id={id}
            {...aria}
            className="min-h-11 sm:min-h-10"
            value={selected}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom") {
                setCustom(true);
                if (variable) onChange("");
              } else {
                setCustom(false);
                onChange(v ? `{{${v}}}` : "");
              }
            }}
          >
            {!required && <option value="">{t.noLink}</option>}
            {vars.map((v) => (
              <option key={v} value={v}>
                {linkLabel(v)}
              </option>
            ))}
            <option value="__custom">{t.customLink}</option>
          </Select>
        )}
      </Field>
      {selected === "__custom" && (
        <div className="space-y-1.5">
          <Label htmlFor={inputId} className="sr-only">
            {t.linkAddress}
          </Label>
          <Input
            id={inputId}
            dir="ltr"
            inputMode="url"
            placeholder="https://"
            aria-invalid={error ? true : undefined}
            value={variable ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(error && "border-danger focus-visible:ring-danger/30")}
          />
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

function ButtonColor({ t, value, error, onChange }: { t: T; value: string; error?: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t.color}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="color"
          aria-label={t.colorPicker}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2563EB"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-11 shrink-0 cursor-pointer rounded-[var(--radius)] border border-line-strong bg-paper-raised p-1 sm:size-10"
        />
        {value ? (
          <span className="font-mono text-sm text-ink" dir="ltr">
            {value}
          </span>
        ) : (
          <span className="text-sm text-ink-soft">{t.storeColor}</span>
        )}
        {value && (
          <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => onChange("")}>
            {t.useStoreColor}
          </Button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

/** The image: pasted, uploaded (into the media library) or picked from the library. */
export function ImageSource({ t, value, error, onChange }: { t: T; value: string; error?: string; onChange: (url: string) => void }) {
  const id = useId();
  const [library, setLibrary] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t.imageSource}</Label>
      <ImageUrlInput id={id} value={value} onChange={onChange} />
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-8" aria-expanded={library} onClick={() => setLibrary((v) => !v)}>
        <IconMedia className="size-4" aria-hidden />
        {library ? t.hideLibrary : t.fromLibrary}
      </Button>
      {library && (
        <MediaLibraryPicker
          t={t}
          selected={value}
          onPick={(url) => {
            onChange(url);
            setLibrary(false);
          }}
        />
      )}
    </div>
  );
}

function MediaLibraryPicker({ t, selected, onPick }: { t: T; selected: string; onPick: (url: string) => void }) {
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(before?: string) {
    setLoading(true);
    setError(null);
    try {
      const page = await apiClient.listMedia(workspaceId, { limit: 24, ...(before ? { before } : {}) });
      setItems((prev) => (before ? [...prev, ...page.media] : page.media));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const images = items.filter((m) => m.mimeType.startsWith("image/"));
  return (
    <div className="space-y-2 rounded-[var(--radius)] bg-paper-sunken p-2">
      {error ? (
        <p className="p-2 text-xs font-medium text-danger">{error}</p>
      ) : !loading && images.length === 0 ? (
        <p className="p-2 text-xs text-ink-soft">{t.libraryEmpty}</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                aria-label={fmt(t.libraryPick, { n: i + 1 })}
                aria-pressed={selected === m.url}
                onClick={() => onPick(m.url)}
                className={cn(
                  "block aspect-square w-full cursor-pointer overflow-hidden rounded-[var(--radius)] bg-paper-raised ring-1 hover:ring-primary focus-visible:outline-2 focus-visible:outline-primary",
                  selected === m.url ? "ring-2 ring-primary" : "ring-line"
                )}
              >
                {/* Through the dashboard's own origin, as the media library shows it (lib/media.ts). */}
                <img src={imageSrc(m.url) ?? m.url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <p className="flex justify-center p-2" role="status">
          <ZLoader aria-hidden />
        </p>
      )}
      {!loading && cursor && !error && (
        <Button type="button" size="sm" variant="outline" className="min-h-11 w-full sm:min-h-8" onClick={() => void load(cursor)}>
          {t.loadMore}
        </Button>
      )}
    </div>
  );
}
