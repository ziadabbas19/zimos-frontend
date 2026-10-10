import type { WebsitePage } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { PageProductField } from "../DataBinding";
import { PageSettingsDialog } from "../PageSettingsDialog";
import { SHELL_STRINGS } from "./shellStrings";
import type { TreeMeta } from "./useEditorDocument";

/**
 * «إعدادات الصفحة» from the toolbar's «…»: the shared page-settings dialog
 * (SEO and scripts, as before), opened on SEO, plus a Details tab that holds
 * what used to sit on the start pane — the page's product, the one product
 * bindings read when an element names none. The product is part of the page
 * draft (`tree.productId`), so changing it saves with the page.
 */
export function EditorPageSettings({
  page,
  treeMeta,
  onTreeMetaChange,
  onSaveSeo,
  onClose,
}: {
  page: WebsitePage;
  treeMeta: TreeMeta;
  onTreeMetaChange: (update: (prev: TreeMeta) => TreeMeta) => void;
  /** Saved at once; live with the next publish. */
  onSaveSeo: (seo: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT(SHELL_STRINGS);
  const productId =
    typeof (treeMeta as { productId?: unknown }).productId === "string"
      ? ((treeMeta as { productId?: string }).productId ?? "")
      : "";

  function setProductId(next: string) {
    onTreeMetaChange((prev) => {
      const { productId: _old, ...rest } = prev as typeof prev & { productId?: string };
      void _old;
      return (next ? { ...rest, productId: next } : rest) as typeof prev;
    });
  }

  return (
    <PageSettingsDialog
      name={page.title}
      seo={(page.seo ?? {}) as Record<string, unknown>}
      scripts={{ kind: "page", id: page.id }}
      initialTab="seo"
      onSaveSeo={onSaveSeo}
      details={
        <div className="space-y-3">
          <dl className="rounded-[0.875rem] bg-paper-sunken px-3 py-2.5 text-sm">
            <dt className="text-xs text-ink-soft">{t.pageInfo}</dt>
            <dd className="font-medium text-ink">{page.title}</dd>
            <dt className="mt-2 text-xs text-ink-soft">{t.pagePath}</dt>
            <dd className="text-ink">
              <bdi dir="ltr">{page.path}</bdi>
            </dd>
          </dl>
          <PageProductField value={productId} onChange={setProductId} />
        </div>
      }
      onClose={onClose}
    />
  );
}
