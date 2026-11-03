"use client";

import { useEffect, useState } from "react";
import { StoreLink } from "@/components/StoreRoute";

const ROTATE_MS = 5000;

/**
 * The header strip's announcement. One line stays put; several take turns —
 * every five seconds, never under reduced motion, held while the pointer is on
 * it — with a button either side to move by hand. Every look draws the
 * buttons; the looks that have them show them (app/xs-shell.css hides them).
 */
export function XsNotice({ messages, href, labels }: { messages: string[]; href: string | null; labels: { prev: string; next: string } }) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const count = messages.length;

  useEffect(() => {
    if (count < 2 || held) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, held, index]);

  const message = messages[index % count] ?? "";
  const text = href ? <StoreLink href={href}>{message}</StoreLink> : message;
  if (count < 2) return <>{text}</>;
  return (
    <span className="xs-notice" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}>
      <button type="button" className="xs-notice__step" aria-label={labels.prev} onClick={() => setIndex((i) => (i - 1 + count) % count)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5.5 6.5 6.5L9 18.5" />
        </svg>
      </button>
      <span className="xs-notice__text" aria-live="polite">
        {text}
      </span>
      <button type="button" className="xs-notice__step" aria-label={labels.next} onClick={() => setIndex((i) => (i + 1) % count)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5.5 8.5 12l6.5 6.5" />
        </svg>
      </button>
    </span>
  );
}
