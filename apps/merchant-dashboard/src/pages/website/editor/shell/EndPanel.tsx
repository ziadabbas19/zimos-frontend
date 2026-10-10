import type { ReactNode } from "react";
import { IconTheme } from "@/components/icons";
import { useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "./shellStrings";

/**
 * The end zone on a wide screen (20rem): the inspector of whatever is
 * selected, or — with nothing selected — the store look. Its body is whichever
 * panel the page passes; each scrolls inside it.
 */
export function EndPanel({ children }: { children: ReactNode }) {
  const t = useT(SHELL_STRINGS);
  return (
    <aside
      data-slot="editor-panel"
      data-side="end"
      aria-label={t.endPanel}
      className="flex w-80 shrink-0 flex-col border-s border-line bg-paper-raised"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </aside>
  );
}

/** What heads the end panel while nothing is selected: the look's name and the one-line way in. */
export function LookIntro() {
  const t = useT(SHELL_STRINGS);
  return (
    <div className="flex shrink-0 items-start gap-2.5 border-b border-line px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-dark dark:text-primary">
        <IconTheme className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-sm font-semibold text-ink">{t.lookTitle}</h2>
        <p className="text-xs leading-5 text-ink-soft">{t.lookHint}</p>
      </div>
    </div>
  );
}
