import { useEffect, useId, useState } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import { emailCampaignProducts, type EmailCampaignBlockType, type EmailCampaignProduct } from "@store-builder/api-client";
import {
  IconArrowDown,
  IconArrowUp,
  IconClick,
  IconDelete,
  IconDivider,
  IconHeading,
  IconImage,
  IconParagraph,
  IconProducts,
} from "@/components/icons";
import { Field, TextField } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { Textarea } from "@/components/Textarea";
import { apiClient } from "@/lib/apiClient";
import { formatMinorMoney } from "@/lib/format";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT } from "@/i18n/LocaleContext";
import { CAMPAIGN_STRINGS, type CampaignText } from "./campaignStrings";
import { MAX_BLOCKS, MAX_PRODUCTS, emptyBlock, moveBlock, type BlockDraft, type Problems } from "./campaignForm";

const ADDABLE: Array<{ type: EmailCampaignBlockType; icon: typeof IconHeading }> = [
  { type: "heading", icon: IconHeading },
  { type: "text", icon: IconParagraph },
  { type: "image", icon: IconImage },
  { type: "button", icon: IconClick },
  { type: "products", icon: IconProducts },
  { type: "divider", icon: IconDivider },
];

const typeName = (t: CampaignText, type: EmailCampaignBlockType) => t[`block_${type}` as keyof CampaignText] as string;

/** The store's products to pick for a products block: search, tick up to six. */
function ProductPicker({ value, onChange, error }: { value: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const t = useT(CAMPAIGN_STRINGS);
  const workspaceId = useWorkspaceId();
  const searchId = useId();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<EmailCampaignProduct[]>([]);
  const [known, setKnown] = useState<Record<string, EmailCampaignProduct>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      emailCampaignProducts(apiClient, workspaceId, q)
        .then((list) => {
          if (!live) return;
          setFound(list);
          setKnown((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, p])) }));
        })
        .catch(() => live && setFound([]))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [workspaceId, q]);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : value.length >= MAX_PRODUCTS ? value : [...value, id]);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{fmt(t.productsPick, { max: String(MAX_PRODUCTS) })}</legend>
      <label htmlFor={searchId} className="sr-only">
        {t.productsSearch}
      </label>
      <Input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.productsSearch} className="pointer-coarse:min-h-11" />
      <p className="text-xs text-ink-soft" aria-live="polite">
        {fmt(t.productsChosen, { count: String(value.length) })}
      </p>
      <ul className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-line p-1" aria-busy={loading || undefined}>
        {!loading && found.length === 0 && <li className="px-2 py-3 text-sm text-ink-soft">{t.productsNone}</li>}
        {found.map((p) => {
          const checked = value.includes(p.id);
          const full = !checked && value.length >= MAX_PRODUCTS;
          return (
            <li key={p.id}>
              <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-paper-sunken", full && "cursor-not-allowed opacity-50")}>
                <input type="checkbox" checked={checked} disabled={full} onChange={() => toggle(p.id)} className="size-4 accent-[var(--color-primary)]" />
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-8 shrink-0 rounded object-cover" /> : <span aria-hidden className="size-8 shrink-0 rounded bg-paper-sunken" />}
                <span className="min-w-0 flex-1 truncate text-sm text-ink" dir="auto">
                  {p.name}
                </span>
                {p.price !== null && (
                  <bdi dir="ltr" className="shrink-0 text-xs text-ink-soft">
                    {formatMinorMoney(p.price, p.currency ?? "EGP")}
                  </bdi>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={fmt(t.productsChosen, { count: String(value.length) })}>
          {value.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => toggle(id)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-paper px-3 text-xs text-ink hover:border-danger hover:text-danger focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11"
                aria-label={`${t.remove}: ${known[id]?.name ?? id}`}
              >
                <span className="max-w-[10rem] truncate" dir="auto">
                  {known[id]?.name ?? "…"}
                </span>
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

function AlignChoice({ value, onChange }: { value: BlockDraft["align"]; onChange: (v: BlockDraft["align"]) => void }) {
  const t = useT(CAMPAIGN_STRINGS);
  return (
    <Segmented
      label={t.align}
      size="sm"
      value={value}
      onChange={(v) => onChange(v)}
      options={[
        { value: "start", label: t.alignStart },
        { value: "center", label: t.alignCenter },
        { value: "end", label: t.alignEnd },
      ]}
    />
  );
}

function BlockFields({ block, onChange, problems }: { block: BlockDraft; onChange: (patch: Partial<BlockDraft>) => void; problems: Problems }) {
  const t = useT(CAMPAIGN_STRINGS);
  const err = (field: string) => {
    const p = problems[`blocks.${block.key}.${field}`];
    return p ? (t[p] as string) : undefined;
  };
  switch (block.type) {
    case "heading":
      return (
        <div className="space-y-3">
          <TextField label={t.headingText} value={block.text} maxLength={200} onChange={(e) => onChange({ text: e.target.value })} error={err("text")} required dir="auto" />
          <div className="flex flex-wrap gap-3">
            <Segmented
              label={t.size}
              size="sm"
              value={block.size}
              onChange={(v) => onChange({ size: v })}
              options={[
                { value: "lg", label: t.sizeLarge },
                { value: "md", label: t.sizeMedium },
              ]}
            />
            <AlignChoice value={block.align} onChange={(align) => onChange({ align })} />
          </div>
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          <Field label={t.bodyText} hint={t.bodyTextHint} error={err("text")} required>
            {({ id, ...aria }) => <Textarea id={id} {...aria} rows={5} maxLength={5000} value={block.text} onChange={(e) => onChange({ text: e.target.value })} dir="auto" />}
          </Field>
          <AlignChoice value={block.align} onChange={(align) => onChange({ align })} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <TextField label={t.imageUrl} hint={t.imageUrlHint} type="url" inputMode="url" dir="ltr" value={block.url} onChange={(e) => onChange({ url: e.target.value })} error={err("url")} required />
          <TextField label={t.imageAlt} hint={t.imageAltHint} value={block.alt} maxLength={200} onChange={(e) => onChange({ alt: e.target.value })} dir="auto" />
          <TextField label={t.imageLink} type="url" inputMode="url" dir="ltr" value={block.link} onChange={(e) => onChange({ link: e.target.value })} error={err("link")} />
          <AlignChoice value={block.align} onChange={(align) => onChange({ align })} />
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <TextField label={t.buttonLabel} value={block.label} maxLength={80} onChange={(e) => onChange({ label: e.target.value })} error={err("label")} required dir="auto" />
          <TextField label={t.buttonUrl} type="url" inputMode="url" dir="ltr" value={block.url} onChange={(e) => onChange({ url: e.target.value })} error={err("url")} required />
          <div className="flex flex-wrap items-end gap-3">
            <TextField label={t.buttonColor} hint={t.buttonColorHint} dir="ltr" placeholder="#1D4ED8" value={block.color} maxLength={7} onChange={(e) => onChange({ color: e.target.value })} error={err("color")} className="w-40" />
            <AlignChoice value={block.align} onChange={(align) => onChange({ align })} />
          </div>
        </div>
      );
    case "products":
      return (
        <div className="space-y-3">
          <ProductPicker value={block.productIds} onChange={(productIds) => onChange({ productIds })} error={err("productIds")} />
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={block.showPrice} onChange={(e) => onChange({ showPrice: e.target.checked })} className="size-4 accent-[var(--color-primary)]" />
            {t.showPrice}
          </label>
        </div>
      );
    default:
      return <hr className="border-line" aria-hidden />;
  }
}

/**
 * The email's blocks, top to bottom: each one a card with its fields, moved
 * with the arrow buttons (keyboard-friendly, no dragging needed), removed
 * with the bin; new ones are added at the end from the row of block types.
 */
export function BlockEditor({ blocks, onChange, problems }: { blocks: BlockDraft[]; onChange: (blocks: BlockDraft[]) => void; problems: Problems }) {
  const t = useT(CAMPAIGN_STRINGS);
  const update = (key: string, patch: Partial<BlockDraft>) => onChange(blocks.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const counts: Record<string, number> = {};

  return (
    <div className="space-y-3">
      {blocks.length === 0 && <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">{t.noBlocks}</p>}
      <ol className="space-y-3">
        {blocks.map((block, index) => {
          counts[block.type] = (counts[block.type] ?? 0) + 1;
          const title = fmt(t.blockN, { type: typeName(t, block.type), n: String(counts[block.type]) });
          return (
            <li key={block.key} aria-label={title} className="rounded-xl border border-line bg-paper-raised p-3 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{title}</h3>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="pointer-coarse:size-11" aria-label={`${t.moveUp}: ${title}`} disabled={index === 0} onClick={() => onChange(moveBlock(blocks, index, -1))}>
                    <IconArrowUp aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="pointer-coarse:size-11" aria-label={`${t.moveDown}: ${title}`} disabled={index === blocks.length - 1} onClick={() => onChange(moveBlock(blocks, index, 1))}>
                    <IconArrowDown aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-danger pointer-coarse:size-11" aria-label={`${t.remove}: ${title}`} onClick={() => onChange(blocks.filter((b) => b.key !== block.key))}>
                    <IconDelete aria-hidden />
                  </Button>
                </div>
              </div>
              <BlockFields block={block} onChange={(patch) => update(block.key, patch)} problems={problems} />
            </li>
          );
        })}
      </ol>
      {problems.blocks && <p className="text-xs font-medium text-danger">{t[problems.blocks]}</p>}
      {blocks.length < MAX_BLOCKS && (
        <div role="group" aria-label={t.addBlock} className="rounded-xl border border-dashed border-line p-3">
          <p className="mb-2 text-xs font-medium text-ink-soft">{t.addBlock}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ADDABLE.map(({ type, icon: Icon }) => (
              <Button key={type} type="button" variant="outline" className="min-h-11 justify-start" onClick={() => onChange([...blocks, emptyBlock(type)])}>
                <Icon aria-hidden />
                {typeName(t, type)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
