import { useCallback, useId, useMemo, useState, type FormEvent } from "react";
import { IconBookmark, IconCaretDown, IconDelete, IconLink, IconLinkOff, IconPlus } from "@/components/icons";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  SAVED_SECTION_LINK_KEY,
  storeDesignCreateSavedSection,
  storeDesignDeleteSavedSection,
  storeDesignListSavedSections,
  storeDesignUpdateSavedSection,
  type PageSection,
  type SavedSectionDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SkeletonBar } from "@/components/DataState";
import { Sheet } from "@/components/Sheet";
import { sectionElements, sectionLabel } from "./blocks";
import { SectionThumbnail } from "./BlockThumbnail";
import { useEditorLocale } from "./editorLocale";
import { leftUi } from "./library/strings";

/**
 * Saved sections in the website editor (SPEC §9.3 "smart sections").
 *
 * A section can be saved to the store's library. From the library it is
 * inserted either as a plain copy, or linked: a linked section carries
 * `settings.savedSectionId`, and publishing the website fills it from the
 * saved section — so updating the saved section and publishing changes every
 * linked copy. "Detach" removes the link and leaves an ordinary section.
 *
 * Four pieces live here:
 *  - `SavedSectionsLibrary` — the foldable list of the in-panel library (the
 *    funnel step editor's side pane);
 *  - `SavedSectionsGrid` — the same library as the «محفوظاتي» view of the
 *    library sheet (BlockLibrary.tsx), with a drawing of each section;
 *  - `SaveSectionPanel` — in the inspector: save this section, or manage its
 *    link to a saved one;
 *  - `SaveSectionSheet` — the same save, as a small sheet opened from a
 *    section's «…» menu in the section list.
 */

const STRINGS = {
  en: {
    title: "Saved sections",
    empty: "Nothing saved yet. Open a section and save it to use it again on any page.",
    insert: "Add a copy",
    insertLinked: "Add linked",
    saveTitle: "Reuse this section",
    name: "Name for the saved section",
    save: "Save to library",
    saved: "Section saved to the library.",
    linked: "This section is linked to a saved section. Its content is taken from the library when you publish.",
    update: "Update the saved section with this content",
    updated: "Saved section updated. Publish to apply it to every linked copy.",
    detach: "Detach",
    // Funnel-only saved sections (backend savedSections: scope "funnel").
    onlyThisFunnel: "Only in this funnel",
    funnelOnly: "This funnel",
  },
  ar: {
    title: "السكاشن المحفوظة",
    empty: "لا يوجد شيء محفوظ بعد. افتح قسمًا واحفظه لتستخدمه في أي صفحة.",
    insert: "إدراج نسخة",
    insertLinked: "إدراج مرتبط",
    saveTitle: "إعادة استخدام هذا القسم",
    name: "اسم القسم المحفوظ",
    save: "حفظ في المكتبة",
    saved: "تم حفظ القسم في المكتبة.",
    linked: "هذا القسم مرتبط بقسم محفوظ. محتواه يؤخذ من المكتبة عند النشر.",
    update: "تحديث القسم المحفوظ بهذا المحتوى",
    updated: "تم تحديث القسم المحفوظ. انشر الموقع لتطبيقه على كل النسخ المرتبطة.",
    detach: "فصل",
    onlyThisFunnel: "في هذا الفانل فقط",
    funnelOnly: "هذا الفانل",
  },
} as const;

const uid = () => Math.random().toString(36).slice(2, 10);

/** A fresh copy of a saved section: new ids throughout, so two copies never clash on a page. */
export function instantiateSavedSection(saved: SavedSectionDto, linked: boolean): PageSection {
  const stamp = uid();
  const renamed = JSON.parse(JSON.stringify(saved.tree)) as PageSection;
  const bump = (node: { id?: string }) => {
    node.id = `${typeof node.id === "string" && node.id ? node.id : "n"}-${stamp}`;
  };
  bump(renamed);
  for (const row of renamed.rows ?? []) {
    bump(row);
    for (const column of row.columns ?? []) {
      bump(column);
      for (const element of column.elements ?? []) bump(element);
    }
  }
  const settings = { ...(renamed.settings ?? {}) } as Record<string, unknown>;
  if (linked) settings[SAVED_SECTION_LINK_KEY] = saved.id;
  else delete settings[SAVED_SECTION_LINK_KEY];
  return { ...renamed, settings };
}

export function linkedSavedSectionId(section: PageSection): string | null {
  const value = (section.settings as Record<string, unknown> | undefined)?.[SAVED_SECTION_LINK_KEY];
  return typeof value === "string" && value ? value : null;
}

/** The section without its link — what gets stored in the library and what "detach" leaves. */
function withoutLink(section: PageSection): PageSection {
  const settings = { ...(section.settings ?? {}) } as Record<string, unknown>;
  delete settings[SAVED_SECTION_LINK_KEY];
  const { settings: _old, ...bare } = section;
  void _old;
  return Object.keys(settings).length > 0 ? { ...bare, settings } : bare;
}

// ---------------------------------------------------------------------------
// The library's data, shared by its two views
// ---------------------------------------------------------------------------

export interface SavedSectionsState {
  list: SavedSectionDto[];
  /** True until the first answer. */
  loading: boolean;
  error: unknown;
  /** Reads the library again, keeping what is shown until the answer arrives. */
  refresh: () => Promise<void>;
  /** Deletes one from the library and drops it from the list. Throws when the server refuses. */
  remove: (saved: SavedSectionDto) => Promise<void>;
}

/**
 * The store's saved sections (plus `funnelId`'s own, inside a funnel).
 * `enabled: false` asks for nothing — for a library that has nowhere to put a
 * saved section.
 */
export function useSavedSections(funnelId?: string, enabled = true): SavedSectionsState {
  const workspaceId = useWorkspaceId();
  const state = useAsync<SavedSectionDto[]>(
    () => (enabled && workspaceId ? storeDesignListSavedSections(apiClient, workspaceId, funnelId) : Promise.resolve([])),
    [workspaceId, funnelId, enabled]
  );
  const { refresh: reload, setData } = state;

  const refresh = useCallback(() => reload({ silent: true }), [reload]);
  const remove = useCallback(
    async (saved: SavedSectionDto) => {
      await storeDesignDeleteSavedSection(apiClient, workspaceId, saved.id);
      setData((prev) => (prev ?? []).filter((item) => item.id !== saved.id));
    },
    [workspaceId, setData]
  );

  return useMemo(
    () => ({ list: state.data ?? [], loading: state.loading, error: state.error, refresh, remove }),
    [state.data, state.loading, state.error, refresh, remove]
  );
}

/** «تمسح … من مكتبتك؟» — asked once before a saved section is deleted for good. */
function RemoveSavedDialog({
  saved,
  library,
  onClose,
}: {
  saved: SavedSectionDto | null;
  library: SavedSectionsState;
  onClose: () => void;
}) {
  const t = leftUi(useEditorLocale());
  const toast = useToast();
  return (
    <ConfirmDialog
      open={saved !== null}
      title={saved ? t.removeSavedTitle(saved.name) : ""}
      description={t.removeSavedBody}
      confirmLabel={t.removeSavedConfirm}
      cancelLabel={t.cancel}
      destructive
      onCancel={onClose}
      onConfirm={async () => {
        if (!saved) return;
        await library.remove(saved);
        toast.success(t.savedRemoved);
        onClose();
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// In the panel library (the funnel step editor): a foldable list
// ---------------------------------------------------------------------------

/**
 * The library list, shown above the block library: insert a copy or a linked
 * copy. In a funnel's editor (`funnelId`) it adds that funnel's own sections.
 */
export function SavedSectionsLibrary({ onInsert, funnelId }: { onInsert: (section: PageSection) => void; funnelId?: string }) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  const ui = leftUi(locale);
  const library = useSavedSections(funnelId);
  const [open, setOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<SavedSectionDto | null>(null);
  const list = library.list;

  return (
    <div className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void library.refresh();
        }}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-4 py-2 text-start text-sm font-medium text-ink transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <IconBookmark className="size-4 shrink-0 text-ink-soft" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t.title}</span>
        {list.length > 0 && <span className="shrink-0 text-xs font-normal text-ink-soft tabular-nums">{ui.items(list.length)}</span>}
        <IconCaretDown
          className={cn(
            "size-4 shrink-0 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            !open && "-rotate-90 rtl:rotate-90"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {list.length === 0 ? (
            <p className="px-1 text-xs leading-5 text-ink-soft">{t.empty}</p>
          ) : (
            list.map((saved) => (
              <div key={saved.id} className="rounded-[0.875rem] bg-paper-raised p-2 ring-1 ring-line">
                <p className="flex items-center gap-1.5 px-1 text-sm font-medium text-ink">
                  <span className="truncate" dir="auto">
                    {saved.name}
                  </span>
                  {saved.scope === "funnel" && (
                    <span className="shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-[0.65rem] font-medium text-primary-dark dark:text-primary">
                      {t.funnelOnly}
                    </span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full pointer-coarse:min-h-11"
                    onClick={() => onInsert(instantiateSavedSection(saved, false))}
                  >
                    {t.insert}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full pointer-coarse:min-h-11"
                    title={ui.linkedHint}
                    onClick={() => onInsert(instantiateSavedSection(saved, true))}
                  >
                    <IconLink className="size-3.5" aria-hidden />
                    {t.insertLinked}
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="ms-auto rounded-full pointer-coarse:size-11"
                    aria-label={ui.removeSavedAria(saved.name)}
                    title={ui.removeSaved}
                    onClick={() => setPendingRemove(saved)}
                  >
                    <IconDelete className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <RemoveSavedDialog saved={pendingRemove} library={library} onClose={() => setPendingRemove(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// In the library sheet: «محفوظاتي»
// ---------------------------------------------------------------------------

/**
 * The saved sections as the library sheet shows them: a drawing of each, its
 * name, and the three things to do with it — add a copy, add it linked, or
 * delete it from the library.
 */
export function SavedSectionsGrid({
  library,
  onInsert,
  className,
}: {
  library: SavedSectionsState;
  onInsert: (section: PageSection) => void;
  className?: string;
}) {
  const locale = useEditorLocale();
  const t = leftUi(locale);
  const [pendingRemove, setPendingRemove] = useState<SavedSectionDto | null>(null);
  const { list, loading, error } = library;

  if (loading && list.length === 0) {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-[1.25rem] bg-paper-raised p-3 ring-1 ring-line">
            <SkeletonBar className="aspect-[16/10] h-auto w-28 shrink-0 rounded-[0.75rem]" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBar className="w-2/5" />
              <SkeletonBar className="h-2.5 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && list.length === 0) {
    return (
      <div role="alert" className={cn("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}>
        <p className="text-sm text-ink">{t.savedLoadFailed}</p>
        <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={() => void library.refresh()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
        <IconBookmark className="size-11 text-primary" aria-hidden />
        <p className="font-display text-base font-semibold text-ink">{t.savedEmptyTitle}</p>
        <p className="max-w-sm text-sm leading-6 text-ink-soft">{t.savedEmptyBody}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="mb-3 text-xs leading-5 text-ink-soft">{t.linkedHint}</p>
      <ul className="space-y-3">
        {list.map((saved) => (
          <li
            key={saved.id}
            data-slot="saved-section"
            className="zimos-saved-card flex flex-col gap-3 rounded-[1.25rem] bg-paper-raised p-3 ring-1 ring-line sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="block w-28 shrink-0">
                <SectionThumbnail section={saved.tree} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink" dir="auto">
                  {saved.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-soft">
                  {sectionLabel(saved.tree, locale)} · {t.elements(sectionElements(saved.tree).length)}
                </span>
                {saved.scope === "funnel" && (
                  <span className="mt-1 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-medium text-primary-dark dark:text-primary">
                    {t.funnelOnly}
                  </span>
                )}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                className="min-h-11 flex-1 rounded-full px-4 sm:flex-none pointer-fine:min-h-9"
                onClick={() => onInsert(instantiateSavedSection(saved, false))}
              >
                <IconPlus className="size-4" aria-hidden />
                {t.insertCopy}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 rounded-full px-4 sm:flex-none pointer-fine:min-h-9"
                title={t.linkedHint}
                onClick={() => onInsert(instantiateSavedSection(saved, true))}
              >
                <IconLink className="size-4" aria-hidden />
                {t.insertLinked}
              </Button>
              <button
                type="button"
                aria-label={t.removeSavedAria(saved.name)}
                title={t.removeSaved}
                onClick={() => setPendingRemove(saved)}
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-fine:size-9"
              >
                <IconDelete className="size-[18px]" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <RemoveSavedDialog saved={pendingRemove} library={library} onClose={() => setPendingRemove(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saving a section
// ---------------------------------------------------------------------------

/**
 * In the section inspector: save this section, or manage its link to a saved
 * one. In a funnel's editor (`funnelId`) it may be kept for that funnel only.
 */
export function SaveSectionPanel({ section, onChange, funnelId }: { section: PageSection; onChange: (next: PageSection) => void; funnelId?: string }) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [funnelOnly, setFunnelOnly] = useState(false);
  const linkId = linkedSavedSectionId(section);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (linkId) {
    return (
      <div className="space-y-2 border-t border-line px-4 py-3">
        <Alert>{t.linked}</Alert>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="pointer-coarse:min-h-11"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await storeDesignUpdateSavedSection(apiClient, workspaceId, linkId, { section: withoutLink(section) });
                toast.success(t.updated);
              })
            }
          >
            {t.update}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="pointer-coarse:min-h-11"
            disabled={busy}
            onClick={() => onChange(withoutLink(section))}
          >
            <IconLinkOff className="size-4" aria-hidden />
            {t.detach}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-line px-4 py-3">
      <p className="text-xs font-medium text-ink-soft">{t.saveTitle}</p>
      <div className="flex items-center gap-2">
        <Input aria-label={t.name} placeholder={t.name} maxLength={120} value={name} disabled={busy} dir="auto" onChange={(e) => setName(e.target.value)} />
        <Button
          type="button"
          size="sm"
          className="pointer-coarse:min-h-11"
          disabled={busy || !name.trim()}
          onClick={() =>
            void run(async () => {
              await storeDesignCreateSavedSection(apiClient, workspaceId, {
                name: name.trim(),
                section: withoutLink(section),
                ...(funnelId && funnelOnly ? { scope: "funnel" as const, funnelId } : {}),
              });
              setName("");
              toast.success(t.saved);
            })
          }
        >
          {t.save}
        </Button>
      </div>
      {funnelId && (
        <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-ink pointer-coarse:min-h-11">
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-primary"
            checked={funnelOnly}
            disabled={busy}
            onChange={(e) => setFunnelOnly(e.target.checked)}
          />
          {t.onlyThisFunnel}
        </label>
      )}
    </div>
  );
}

/**
 * «احفظه في مكتبتي» from a section's «…» menu: one small sheet that asks for
 * a name and saves the section with the same call the inspector's panel
 * makes. Open while `section` is given.
 */
export function SaveSectionSheet({
  section,
  onClose,
  funnelId,
  onSaved,
}: {
  section: PageSection | null;
  onClose: () => void;
  /** Inside a funnel: offers to keep the section for that funnel only. */
  funnelId?: string;
  onSaved?: (saved: SavedSectionDto) => void;
}) {
  const t = leftUi(useEditorLocale());
  const formId = useId();
  const [busy, setBusy] = useState(false);

  return (
    <Sheet
      open={section !== null}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      title={t.saveSheetTitle}
      description={t.saveSheetHint}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            <IconBookmark className="size-4" aria-hidden />
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      {section && (
        <SaveSectionForm
          // A different section starts from its own name.
          key={section.id}
          formId={formId}
          section={section}
          funnelId={funnelId}
          busy={busy}
          onBusyChange={setBusy}
          onSaved={(saved) => {
            onSaved?.(saved);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function SaveSectionForm({
  formId,
  section,
  funnelId,
  busy,
  onBusyChange,
  onSaved,
}: {
  formId: string;
  section: PageSection;
  funnelId?: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: (saved: SavedSectionDto) => void;
}) {
  const locale = useEditorLocale();
  const t = leftUi(locale);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const nameId = useId();
  // The section's own name is a fair first guess: saving is then one press.
  const [name, setName] = useState(() => sectionLabel(section, locale));
  const [funnelOnly, setFunnelOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || busy) return;
    onBusyChange(true);
    setError(null);
    try {
      const saved = await storeDesignCreateSavedSection(apiClient, workspaceId, {
        name: clean,
        section: withoutLink(section),
        ...(funnelId && funnelOnly ? { scope: "funnel" as const, funnelId } : {}),
      });
      toast.success(t.savedDone);
      onBusyChange(false);
      onSaved(saved);
    } catch (err) {
      onBusyChange(false);
      setError(errorMessage(err));
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex items-center gap-3">
        <span className="block w-24 shrink-0">
          <SectionThumbnail section={section} />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor={nameId} className="block text-sm font-medium text-ink">
            {t.saveName}
          </label>
          <Input
            id={nameId}
            value={name}
            maxLength={120}
            required
            disabled={busy}
            dir="auto"
            placeholder={t.saveNamePlaceholder}
            className="h-11"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
      {funnelId && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="size-5 shrink-0 cursor-pointer accent-primary"
            checked={funnelOnly}
            disabled={busy}
            onChange={(e) => setFunnelOnly(e.target.checked)}
          />
          {t.saveOnlyThisFunnel}
        </label>
      )}
    </form>
  );
}
