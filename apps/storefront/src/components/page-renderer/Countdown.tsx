"use client";

import { useEffect, useState } from "react";

/**
 * The `countdown` element stores only `endsInHours` — a duration, with no
 * anchor date anywhere in the tree. The only coherent reading is "ends N hours
 * from now", so the deadline is computed in the browser on mount. It
 * deliberately is *not* computed on the server: these pages are cached
 * (`revalidate`), and a server-side deadline would be frozen into the cached
 * HTML and drift for every later visitor.
 */
function parts(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: total === 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ label, endsInHours }: { label: string; endsInHours: number }) {
  // Seeded with the full duration so the server HTML and the first client
  // render agree; the interval below takes over a second later. The deadline is
  // pinned inside the effect rather than in state, which keeps the effect body
  // free of a synchronous setState.
  const [left, setLeft] = useState(() => endsInHours * 3600_000);

  useEffect(() => {
    const end = Date.now() + endsInHours * 3600_000;
    const id = setInterval(() => setLeft(end - Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsInHours]);

  const { hours, minutes, seconds, done } = parts(left);

  return (
    <div className="rounded-[var(--radius-card)] border border-accent/40 bg-accent-soft px-5 py-4 text-center">
      {label && <p className="text-sm font-medium text-ink">{label}</p>}
      <p
        className="mt-1 font-display text-3xl font-medium tabular-nums text-accent-dark"
        aria-live="off"
      >
        {done ? "00:00:00" : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
      </p>
    </div>
  );
}
