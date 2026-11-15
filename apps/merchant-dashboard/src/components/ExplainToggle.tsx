import { useId, useState } from "react";
import { cn } from "@store-builder/ui";
import { IconQuestions } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { explain: "What is this?", hide: "Hide the explanation" },
  ar: { explain: "ما هذا؟", hide: "إخفاء الشرح" },
} satisfies Messages;

/**
 * A title's explanation, one tap away instead of always in the way (owner,
 * 2026-11-15: "everything placed for a reason, the eye never lost"): a small
 * «؟» beside the title opens the sentence under it and closes it again. The
 * sentence stays in the page (a screen reader and the search still find it);
 * it is only drawn while open. `useExplain` gives the button and the text,
 * for the title's line and the line under it.
 */
export function useExplain(text: string | undefined, { size = "md" }: { size?: "sm" | "md" } = {}) {
  const t = useT(STRINGS);
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!text) return { button: null, text: null };
  const button = (
    <button
      type="button"
      onClick={() => setOpen((on) => !on)}
      aria-expanded={open}
      aria-controls={id}
      aria-label={open ? t.hide : t.explain}
      title={open ? t.hide : t.explain}
      data-slot="explain"
      className={cn(
        "inline-grid shrink-0 cursor-pointer place-items-center rounded-full align-middle transition-colors focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:size-11",
        size === "sm" ? "size-6 [&>svg]:size-3.5" : "size-7 [&>svg]:size-4",
        open ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-paper-sunken hover:text-ink"
      )}
    >
      <IconQuestions aria-hidden />
    </button>
  );
  const body = (
    <p id={id} hidden={!open} className={cn("text-ink-soft", size === "sm" ? "mt-1 text-xs" : "mt-1.5 max-w-prose text-sm")}>
      {text}
    </p>
  );
  return { button, text: body };
}
