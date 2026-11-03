"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { StoreLink } from "@/components/StoreRoute";

export interface XsReelCard {
  key: string;
  video: string | null;
  poster: string | null;
  label: string;
  href: string | null;
  /** The product under the video (drawn on the server), or nothing. */
  chip: ReactNode;
}

/**
 * `xs_reels`' row: upright cards that scroll sideways (arrows beside the
 * heading). Videos are muted and loop; only one plays at a time — the first
 * one fully on screen, and none while the row is out of view — so a phone is
 * not asked to decode four at once. Posters are asked for only as the row
 * comes near (they are the heaviest thing on it). The speaker button turns one
 * video's sound on (and every other one's off).
 */
export function XsReels({
  heading,
  text,
  cards,
  labels,
}: {
  heading: string;
  text: string;
  cards: XsReelCard[];
  labels: { prev: string; next: string; sound: string; open: string };
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [near, setNear] = useState(false);
  const [sounding, setSounding] = useState<number | null>(null);

  // Posters (and video data) wait until the row is within a screen of the viewport.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One video at a time: the first that is (almost) wholly visible plays; the rest pause.
  useEffect(() => {
    if (!near || typeof IntersectionObserver === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shown = new Set<number>();
    const pick = () => {
      const first = [...shown].sort((a, b) => a - b)[0];
      videos.current.forEach((video, i) => {
        if (!video) return;
        if (i === first && !reduced) void video.play().catch(() => {});
        else video.pause();
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const i = Number((entry.target as HTMLElement).dataset.reel);
          if (entry.intersectionRatio >= 0.75) shown.add(i);
          else shown.delete(i);
        }
        pick();
      },
      { threshold: [0, 0.75, 1] }
    );
    videos.current.forEach((video) => video && observer.observe(video));
    return () => observer.disconnect();
  }, [near]);

  function step(direction: 1 | -1) {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>(".xs-reels__card");
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    // The row is laid out left to right in both directions (as the theme's was); "next" goes right.
    el.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: "smooth" });
  }

  function toggleSound(i: number) {
    const next = sounding === i ? null : i;
    videos.current.forEach((video, at) => {
      if (!video) return;
      video.muted = at !== next;
      if (at === next) void video.play().catch(() => {});
    });
    setSounding(next);
  }

  return (
    <div ref={root} className="xs-reels__shell">
      <div className="xs-reels__head">
        <div className="xs-reels__intro">
          {heading ? <h2 className="xs-heading">{heading}</h2> : null}
          {text ? <p>{text}</p> : null}
        </div>
        {cards.length > 1 ? (
          <div className="xs-reels__nav">
            <button type="button" className="xs-reels__nav-btn" onClick={() => step(-1)} aria-label={labels.prev}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 5.5 8 12l6.5 6.5" />
              </svg>
            </button>
            <button type="button" className="xs-reels__nav-btn" onClick={() => step(1)} aria-label={labels.next}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      <div ref={track} className="xs-reels__track">
        {cards.map((card, i) => (
          <article key={card.key} className="xs-reels__card">
            {/* The picture is named in the markup from the start (as the slider's later slides do), fetched only when near. */}
            <div className="xs-reels__media" data-poster={card.poster ?? undefined}>
              {card.video ? (
                <video
                  ref={(el) => {
                    videos.current[i] = el;
                  }}
                  data-reel={i}
                  className="xs-reels__video"
                  src={near ? card.video : undefined}
                  poster={near && card.poster ? card.poster : undefined}
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-label={card.label}
                />
              ) : card.poster && near ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="xs-reels__video" src={card.poster} alt="" loading="lazy" decoding="async" />
              ) : null}
              <div className="xs-reels__actions">
                {card.video ? (
                  <button
                    type="button"
                    className="xs-reels__action"
                    aria-label={labels.sound}
                    aria-pressed={sounding === i}
                    onClick={() => toggleSound(i)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
                      {sounding === i ? <path d="M16 9.5c1.2 1.4 1.2 3.6 0 5m2.5-7.5c2.7 2.8 2.7 7.2 0 10" /> : <path d="m16 9 5 5m0-5-5 5" />}
                    </svg>
                  </button>
                ) : null}
                {card.href ? (
                  <StoreLink href={card.href} className="xs-reels__action" aria-label={labels.open}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
                      <path d="M10 6.5v-1h8.5V14h-1" />
                    </svg>
                  </StoreLink>
                ) : null}
              </div>
              {card.chip}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
