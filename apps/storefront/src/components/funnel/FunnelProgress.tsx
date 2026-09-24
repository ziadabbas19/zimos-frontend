"use client";

import { useStore } from "@/lib/StoreContext";

/**
 * Where the shopper is in the funnel, as a row of dots: one per step already
 * finished (the session's `path`), then the current one, lit. The API does not
 * say how many steps lie ahead — a funnel branches on the shopper's answers —
 * so no dots are drawn for steps that may never come; the row grows as the
 * shopper moves.
 */
export function FunnelProgress({ completed }: { completed: number }) {
  const { t } = useStore();
  const current = completed + 1;
  const dots = Array.from({ length: current }, (_, i) => i + 1);

  return (
    <ol aria-label={`${t.funnel.progress} — ${t.funnel.step(current)}`} className="flex items-center justify-center gap-2 py-3">
      {dots.map((n) => {
        const isCurrent = n === current;
        return (
          <li key={n} aria-current={isCurrent ? "step" : undefined} className="flex items-center">
            <span
              aria-hidden
              className={`block h-2.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                isCurrent ? "w-6 bg-primary" : "w-2.5 bg-primary/40"
              }`}
            />
            <span className="sr-only">{t.funnel.step(n)}</span>
          </li>
        );
      })}
    </ol>
  );
}
