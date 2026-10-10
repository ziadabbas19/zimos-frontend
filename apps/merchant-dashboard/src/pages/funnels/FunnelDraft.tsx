import { useEffect, useRef, useState } from "react";
import { Button } from "@store-builder/ui";
import { IconClock } from "@/components/icons";
import { funnelExtrasDiscardDraft, funnelExtrasGetDraft, funnelExtrasSaveDraft } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The funnel map's auto-saved draft (SPEC §9.2 "Saving"). Unsaved work is
 * written to the server a few seconds after the last change, so closing the
 * browser — or opening the funnel on another device — offers "Load draft?" or
 * "Start over" instead of losing it. Saving the funnel for real discards the
 * draft.
 *
 * The draft is the editor's own state, stored as it is under `ui`; the server
 * keeps it without interpreting it.
 */

const STRINGS = {
  en: {
    found: "You have unsaved work from {date}.",
    load: "Load draft",
    discard: "Start over",
    label: "Unsaved work found",
  },
  ar: {
    found: "لديك عمل غير محفوظ من {date}.",
    load: "تحميل المسودة",
    discard: "ابدأ من جديد",
    label: "وُجد عمل غير محفوظ",
  },
} satisfies Messages;

const AUTOSAVE_MS = 4000;

export function useFunnelDraft<T>({
  workspaceId,
  funnelId,
  state,
  dirty,
  ready,
}: {
  workspaceId: string;
  funnelId: string;
  /** The editor's working state. */
  state: T | null;
  dirty: boolean;
  /** True once the funnel itself has loaded. */
  ready: boolean;
}) {
  const [offered, setOffered] = useState<{ ui: T; at: string } | null>(null);
  const looked = useRef<string | null>(null);
  // While an offer is on screen nothing is auto-saved over it.
  const offering = offered !== null;

  // Once per funnel: is there a draft waiting?
  useEffect(() => {
    if (!ready || !funnelId || looked.current === funnelId) return;
    looked.current = funnelId;
    let cancelled = false;
    funnelExtrasGetDraft<{ ui?: T }>(apiClient, workspaceId, funnelId)
      .then((res) => {
        if (!cancelled && res.draft?.ui && res.draftUpdatedAt) setOffered({ ui: res.draft.ui, at: res.draftUpdatedAt });
      })
      .catch(() => {
        /* no draft to offer */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, funnelId]);

  // Auto-save a few seconds after the last change.
  const json = dirty && state ? JSON.stringify(state) : null;
  useEffect(() => {
    if (!json || offering || !funnelId) return;
    const timer = window.setTimeout(() => {
      void funnelExtrasSaveDraft(apiClient, workspaceId, funnelId, { ui: JSON.parse(json) }).catch(() => {
        /* the next change tries again */
      });
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [json, offering, workspaceId, funnelId]);

  /** Forget the draft: after a real save, or when the merchant starts over. */
  function discard() {
    setOffered(null);
    void funnelExtrasDiscardDraft(apiClient, workspaceId, funnelId).catch(() => undefined);
  }

  return { offered, discard, dismiss: () => setOffered(null) };
}

/**
 * The "Load draft?" / "Start over" notice: one slim strip under the editor's
 * bar, 48px and never taller — the sentence gives way (it truncates) before
 * the two actions do, so the map is never pushed down by more than that.
 * Material (tint, rim, the drop-in) is in glass/funnel.css.
 */
export function FunnelDraftBanner({ at, onLoad, onDiscard }: { at: string; onLoad: () => void; onDiscard: () => void }) {
  const t = useT(STRINGS);
  const sentence = fmt(t.found, { date: formatDate(at) });
  return (
    <div
      role="status"
      aria-label={t.label}
      data-slot="funnel-draft"
      className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-accent-soft px-3"
    >
      <IconClock className="size-4 shrink-0 text-accent-dark" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm text-ink" title={sentence}>
        {sentence}
      </p>
      <Button type="button" variant="ghost" onClick={onDiscard} className="h-9 shrink-0 rounded-full px-3 text-ink-soft pointer-coarse:h-11">
        {t.discard}
      </Button>
      <Button type="button" variant="secondary" onClick={onLoad} className="zimos-editor-soft h-9 shrink-0 rounded-full px-3.5 pointer-coarse:h-11">
        {t.load}
      </Button>
    </div>
  );
}
