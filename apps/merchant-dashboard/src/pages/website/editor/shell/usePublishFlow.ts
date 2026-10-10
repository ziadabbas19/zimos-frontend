import { useState } from "react";
import type { PublishProblem } from "@store-builder/api-client";
import { storeUrl } from "@/lib/storeAddress";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { editorUi, useEditorLocale } from "../editorLocale";
import { SHELL_STRINGS } from "./shellStrings";
import type { EditorDocument } from "./useEditorDocument";

/**
 * «انشر», from the press to the toast.
 *
 * The button opens the publish sheet (PublishSheet) instead of publishing at
 * once. While it opens, whatever of the draft is still waiting is stored
 * (`checking`), so the sheet's list of what will change is true. «انشر
 * دلوقتي» stores once more and publishes; a refusal comes back as the
 * server's list of problems (one per offending page) or as one message, and
 * stays in the sheet. After a publish: a toast with «شوف متجرك».
 *
 * `slug` is the store's address (`<slug>.zimos.co`); without one there is no
 * link to offer.
 */
export function usePublishFlow(doc: EditorDocument, slug: string) {
  const t = useT(SHELL_STRINGS);
  const ui = editorUi(useEditorLocale());
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A refused publish comes back with a *list* of problems, so they have their own state.
  const [problems, setProblems] = useState<PublishProblem[]>([]);

  function openStore() {
    if (slug) window.open(storeUrl(slug), "_blank", "noopener");
  }

  function start() {
    setError(null);
    setProblems([]);
    setOpen(true);
    setChecking(true);
    void doc.flush().finally(() => setChecking(false));
  }

  async function publishNow() {
    setPublishing(true);
    setError(null);
    setProblems([]);
    const result = await doc.publish();
    setPublishing(false);
    if (result.ok) {
      setOpen(false);
      toast.notify("success", fmt(t.publishedToast, { n: result.revision.revisionNumber }), {
        action: slug ? { label: t.viewStore, onClick: openStore } : undefined,
        duration: 9000,
      });
      return;
    }
    if (result.reason === "save") {
      setError(t.publishSaveFailed);
      return;
    }
    setProblems(result.problems);
    setError(result.error);
    toast.error(ui.publishFailed);
  }

  return { open, setOpen, start, publishNow, publishing, checking, error, problems, openStore };
}
