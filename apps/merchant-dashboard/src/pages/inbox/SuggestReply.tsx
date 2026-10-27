import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, ZLoader } from "@store-builder/ui";
import { ApiError, aiStart, aiWaitForJob } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    suggest: "Suggest a reply (AI)",
    suggesting: "Writing a reply…",
    failed: "No suggestion this time — write the reply yourself.",
    limit: "This month's AI requests are used up.",
    nothing: "The customer hasn't written anything to answer yet.",
    unavailable: "AI isn't available yet.",
  },
  ar: {
    suggest: "اقترح رد (ذكاء اصطناعي)",
    suggesting: "بكتب رد…",
    failed: "مفيش اقتراح المرة دي — اكتب الرد بنفسك.",
    limit: "طلبات الذكاء الاصطناعي للشهر ده خلصت.",
    nothing: "العميل لسه ماكتبش حاجة نرد عليها.",
    unavailable: "الذكاء الاصطناعي مش متاح لسه.",
  },
} satisfies Messages;

/**
 * The inbox's suggested reply (SPEC §19.2 "Suggested WhatsApp replies",
 * backend ai/featuresP2.js `wa_reply`): from the conversation, the store's
 * facts and the customer's own orders. It only fills the message box — the
 * employee reads it, edits it if needed, and sends it.
 */
export function SuggestReplyButton({ conversationId, onSuggest }: { conversationId: string; onSuggest: (text: string) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function suggest() {
    setBusy(true);
    try {
      const started = await aiStart(apiClient, workspaceId, "wa_reply", { conversationId });
      const job = await aiWaitForJob<"wa_reply">(apiClient, workspaceId, started.id, { intervalMs: 800, timeoutMs: 60000 });
      if (job.status === "succeeded" && job.output) onSuggest(job.output.reply);
      else toast.error(t.failed);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(
        code === "AI_LIMIT_REACHED" ? t.limit : code === "AI_NOTHING_TO_ANSWER" ? t.nothing : code === "AI_NOT_CONFIGURED" ? t.unavailable : errorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="icon" variant="ghost" aria-label={busy ? t.suggesting : t.suggest} title={busy ? t.suggesting : t.suggest} disabled={busy} onClick={() => void suggest()}>
      {busy ? <ZLoader size="sm" /> : <Sparkles className="size-4" aria-hidden />}
    </Button>
  );
}
