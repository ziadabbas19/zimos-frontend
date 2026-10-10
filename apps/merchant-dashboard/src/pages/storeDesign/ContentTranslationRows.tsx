import { useState } from "react";
import { Button } from "@store-builder/ui";
import { contentTranslationsList, contentTranslationsSave, type ContentEntity, type ContentTranslationItem, type StoreLocale } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    nothingPages: "No published pages yet. Publish your website to translate its pages.",
    nothingFunnels: "No published funnels yet.",
    progress: "{done} of {total} translated",
    original: "Original",
    save: "Save",
    saved: "Translation saved.",
    show: "Translate",
    hide: "Close",
  },
  ar: {
    nothingPages: "مفيش صفحات منشورة لسه. انشر موقعك عشان تترجم صفحاته.",
    nothingFunnels: "مفيش فانلز منشورة لسه.",
    progress: "اتترجم {done} من {total}",
    original: "الأصل",
    save: "حفظ",
    saved: "تم حفظ الترجمة.",
    show: "ترجمة",
    hide: "إغلاق",
  },
} satisfies Messages;

/**
 * The text of the live pages or funnels, one card each: every sentence a
 * shopper reads, with a box for it in the chosen language. An empty box keeps
 * the original.
 */
export function ContentTranslationRows({ locale, kind, onSaved }: { locale: StoreLocale; kind: ContentEntity; onSaved: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const items = useAsync(() => contentTranslationsList(apiClient, workspaceId, kind, locale), [workspaceId, kind, locale]);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <DataState
      loading={items.loading}
      error={items.error}
      empty={(items.data ?? []).length === 0}
      emptyMessage={kind === "page" ? t.nothingPages : t.nothingFunnels}
      onRetry={() => void items.refresh()}
    >
      <ul className="divide-y divide-line">
        {(items.data ?? []).map((item) => {
          const done = item.texts.filter((x) => x.translation).length;
          const isOpen = open === item.entityId;
          return (
            <li key={item.entityId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink" dir="auto">
                    {item.label}
                    {item.sub && (
                      <span className="ms-2 text-xs font-normal text-ink-soft" dir="ltr">
                        {item.sub}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">{fmt(t.progress, { done, total: item.texts.length })}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setOpen(isOpen ? null : item.entityId)} aria-expanded={isOpen}>
                  {isOpen ? t.hide : t.show}
                </Button>
              </div>
              {isOpen && (
                <ItemEditor
                  item={item}
                  locale={locale}
                  onSaved={(saved) => {
                    items.setData((prev) => (prev ?? []).map((i) => (i.entityId === saved.entityId ? saved : i)));
                    onSaved();
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </DataState>
  );
}

function ItemEditor({ item, locale, onSaved }: { item: ContentTranslationItem; locale: StoreLocale; onSaved: (item: ContentTranslationItem) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = Object.keys(draft).length > 0;
  useReportDirty(dirty);

  async function save() {
    setBusy(true);
    try {
      const saved = await contentTranslationsSave(apiClient, workspaceId, { entityType: item.entityType, entityId: item.entityId, locale, texts: draft });
      if (saved) onSaved(saved);
      setDraft({});
      toast.success(t.saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-line p-3">
      {item.texts.map((text) => (
        <div key={text.key} className="grid gap-2 md:grid-cols-2">
          <p className="whitespace-pre-line text-sm text-ink-soft" dir="auto">
            <span className="sr-only">{t.original}: </span>
            {text.source}
          </p>
          <Textarea
            aria-label={text.source.slice(0, 80)}
            dir="auto"
            rows={text.source.length > 80 ? 3 : 1}
            maxLength={8000}
            value={draft[text.key] ?? text.translation}
            onChange={(e) => setDraft((prev) => ({ ...prev, [text.key]: e.target.value }))}
          />
        </div>
      ))}
      <div className="flex justify-end">
        <Button size="sm" disabled={!dirty || busy} onClick={() => void save()}>
          {t.save}
        </Button>
      </div>
    </div>
  );
}
