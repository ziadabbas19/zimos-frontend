"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useOptionalCart } from "@/lib/CartProvider";
import type { BuyGroup, GarmentKind } from "@/lib/railGarment";
import { ArtDefs, Defs, DrawnMask, Fabric, GarmentTop, Hanger, Photo, SideArt, SideHanger } from "./railParts";
import { clamp, HOOK_TOP, mix, SIDE, VB_H, VB_W } from "./railGeometry";
import { useImmersiveAllowed } from "./useImmersive";

/** The lifted piece's view: its own chunk, fetched once the shopper reaches the rail (`warmDetail`). */
const loadDetail = () => import("./ClothingRailDetail");
const Detail = dynamic(() => loadDetail().then((m) => m.Detail), { ssr: false });

/**
 * The store's clothes hung on a rail (the template band `xs_rail`). Each
 * piece rests side-on; brushing along the rail turns the one under the pointer
 * to the front, a hanger can be slid along, and a click lifts the piece into a
 * view where it turns to show its back, with a link to its own page.
 *
 * A product with a photo hangs as that photo (a cut-out on a transparent
 * background looks best; its second photo is the back). One without a photo
 * is drawn: a tee, knit, hoodie, shirt, jacket or coat in its own colour.
 *
 * On reduced motion or a weak device (useImmersive) nothing swings or glides:
 * pieces snap to their place, and every product, price and link is the same.
 * Narrow screens get a swipeable carousel with dots instead of the full rail.
 */

export type { GarmentKind };

export interface RailGarment {
  id: string;
  /** Accessible name, caption and detail title. */
  name: string;
  description?: string;
  /** Built-in illustration, used when no image is supplied. */
  kind?: GarmentKind;
  /** Fabric colour of the illustration (any CSS colour). */
  color?: string;
  /** Trim colour for ribs, cords and buttons. */
  trim?: string;
  /** Front photo. Best as a transparent cut-out on a 200 × 310 portrait canvas. Front, back and side photos of one piece must share the same canvas and scale, or the piece changes size as it turns. */
  image?: string;
  /** Back photo; the front photo is reused when omitted. */
  backImage?: string;
  /** Side-on photo shown while the piece rests on the rail; omit to show the front photo turned away. */
  sideImage?: string;
  /** Short hang-tag text such as a price or a size. */
  tag?: string;
  /** The price before a discount, struck through on the tag. */
  tagWas?: string;
  /** A mark at the top of the tag: a discount, or a new piece. */
  badge?: { text: string; tone: "sale" | "new" };
  /** Short facts listed in the detail view. */
  details?: string[];
  /** The product's own page, linked from the detail view. */
  href?: string;
  /** What the shopper picks to add it to the cart from the detail view; absent when it has to be bought from its own page. */
  buy?: RailBuy;
}

/** One variant as the detail view sells it: its choices, stock, and its prices already formatted. */
export interface RailVariant {
  id: string;
  values: Record<string, string>;
  inStock: boolean;
  price: string;
  was?: string;
}

export interface RailBuy {
  groups: BuyGroup[];
  variants: RailVariant[];
  /** The product's default offer, when it prices this (single-variant) product. */
  offerId?: string;
}

export interface ClothingRailLabels {
  front: string;
  back: string;
  close: string;
  show: string;
  view: string;
  addToCart: string;
  adding: string;
  added: string;
  addFailed: string;
  outOfStock: string;
}

export interface ClothingRailProps extends React.ComponentProps<"section"> {
  items: RailGarment[];
  eyebrow?: string;
  heading?: string;
  /** Shown under the rail while nothing is turned to the front. */
  caption?: string;
  /** Call to action rendered under the caption. */
  action?: React.ReactNode;
  /** Turns the pieces to the front one by one until the visitor interacts. */
  autoplay?: boolean;
  /** Milliseconds each piece faces the front during autoplay. */
  interval?: number;
  /** Drawn hanger. Use "none" when your photos already include a hanger with its hook at the top. */
  hanger?: "wood" | "matte" | "none";
  labels?: ClothingRailLabels;
  onOpenChange?: (index: number | null) => void;
}

const ASPECT = VB_W / VB_H;
const RAIL_R = 4.6;
const REST = -70;
const PERSPECTIVE = 1100;
const GAP = 0.035;
const MAX_H = 400;
const MIN_WIDE_H = 200;
const CAROUSEL_H = 340;
const DEFAULT_LABELS: ClothingRailLabels = {
  front: "Front",
  back: "Back",
  close: "Close",
  show: "Show",
  view: "View product",
  addToCart: "Add to cart",
  adding: "Adding…",
  added: "Added to cart",
  addFailed: "Couldn't add it to your cart.",
  outOfStock: "Out of stock",
};

function lambert(angle: number) {
  const r = (angle * Math.PI) / 180;
  const diffuse = Math.max(0, Math.sin(r) * 0.42 + Math.cos(r) * 0.91);
  return 0.66 + 0.34 * diffuse;
}

type Sim = {
  x: number[]; vx: number[]; tx: number[]; px: number[];
  turn: number[]; vturn: number[]; tturn: number[];
  swing: number[]; vswing: number[];
  tag: number[]; vtag: number[];
  drag: number; grab: number; free: number; last: number; raf: number;
};

function emptySim(): Sim {
  return { x: [], vx: [], tx: [], px: [], turn: [], vturn: [], tturn: [], swing: [], vswing: [], tag: [], vtag: [], drag: -1, grab: 0, free: 0, last: 0, raf: 0 };
}

function footprint(h: number, angle: number, sideW = 0.4) {
  const e = clamp(1 - angle / REST, 0, 1);
  const ease = e * e * (3 - 2 * e);
  return h * ASPECT * (sideW + (0.94 - sideW) * ease);
}

export function ClothingRail({
  items,
  eyebrow,
  heading,
  caption,
  action,
  autoplay = false,
  interval = 2600,
  hanger = "wood",
  labels = DEFAULT_LABELS,
  onOpenChange,
  className,
  ...rest
}: ClothingRailProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const count = items.length;
  // The cart where the rail stands on a store page; without one (a page drawn on its own) adding is simply not offered.
  const cart = useOptionalCart();
  const sectionRef = React.useRef(null as HTMLElement | null);
  const stageRef = React.useRef(null as HTMLDivElement | null);
  const slots = React.useRef([] as (HTMLButtonElement | null)[]);
  const swings = React.useRef([] as (HTMLSpanElement | null)[]);
  const turns = React.useRef([] as (HTMLSpanElement | null)[]);
  const sides = React.useRef([] as (HTMLSpanElement | null)[]);
  const drapes = React.useRef([] as (HTMLSpanElement | null)[]);
  const shades = React.useRef([] as (HTMLSpanElement | null)[]);
  const shadows = React.useRef([] as (HTMLSpanElement | null)[]);
  const tags = React.useRef([] as (HTMLSpanElement | null)[]);
  const sim = React.useRef(emptySim());
  const [size, setSize] = React.useState({ width: 0, h: 300, carousel: false });
  const [active, setActive] = React.useState(null as number | null);
  const [focusIndex, setFocusIndex] = React.useState(0);
  const [openIndex, setOpenIndex] = React.useState(null as number | null);
  // Still until the browser says motion is welcome (useImmersive): pieces snap, nothing swings.
  const reduced = !useImmersiveAllowed();
  const [playing, setPlaying] = React.useState(autoplay);
  const [lifted, setLifted] = React.useState(null as number | null);
  // The piece facing the front of the narrow-screen carousel, kept when the shopper lets go of it.
  const [carouselAt, setCarouselAt] = React.useState(0);
  const returnFocus = React.useRef(null as number | null);
  const pointer = React.useRef({ id: -1, index: -1, x: 0, y: 0, t: 0, moved: false, kind: "", swipe: 0, lastX: 0, lastT: 0, v: 0 });
  const sideWidths = React.useMemo(() => items.map((item) => (item.image ? (item.sideImage ? 0.3 : 0.4) : SIDE[item.kind ?? "tee"].width)), [items]);
  // What the animation loop and the pointer handlers read between renders.
  const live = React.useRef({ active: null as number | null, size, reduced, count, openIndex: null as number | null, carouselIndex: 0, sideWidths });
  React.useLayoutEffect(() => {
    live.current = { ...live.current, active, size, reduced, count, openIndex, sideWidths, carouselIndex: carouselAt };
  });

  const carouselIndex = size.carousel ? (active ?? carouselAt) : null;

  // The editor can switch autoplay on and off under a live rail: follow it.
  const [autoplayWas, setAutoplayWas] = React.useState(autoplay);
  if (autoplay !== autoplayWas) {
    setAutoplayWas(autoplay);
    setPlaying(autoplay);
  }

  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = (width: number) => {
      const sideW = live.current.sideWidths.reduce((sum, w) => sum + w, 0) / Math.max(1, live.current.sideWidths.length);
      const restK = footprint(1, REST, sideW) + GAP;
      const activeK = footprint(1, 0, sideW) + GAP;
      const fit = (width - 24) / (count * restK + (activeK - restK));
      const carousel = fit < MIN_WIDE_H;
      const h = carousel ? Math.min(CAROUSEL_H, Math.max(220, width * 0.86)) : Math.min(MAX_H, fit);
      setSize((old) => (Math.abs(old.width - width) < 0.5 && old.carousel === carousel && Math.abs(old.h - h) < 0.5 ? old : { width, h: Math.round(h), carousel }));
    };
    measure(stage.clientWidth);
    const observer = new ResizeObserver((entries) => { const box = entries[0]; if (box) measure(box.contentRect.width); });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [count]);

  const targets = React.useCallback((h: number, width: number, carousel: boolean, front: number | null) => {
    const feet = items.map((_, i) => footprint(h, i === front ? 0 : REST, sideWidths[i]) + h * GAP);
    if (carousel) {
      const centre = front ?? 0;
      const xs = feet.map(() => 0);
      xs[centre] = width / 2;
      for (let i = centre + 1; i < feet.length; i++) xs[i] = (xs[i - 1] ?? 0) + ((feet[i - 1] ?? 0) + (feet[i] ?? 0)) / 2;
      for (let i = centre - 1; i >= 0; i--) xs[i] = (xs[i + 1] ?? 0) - ((feet[i + 1] ?? 0) + (feet[i] ?? 0)) / 2;
      return xs;
    }
    const total = feet.reduce((sum, f) => sum + f, 0);
    let cursor = (width - total) / 2;
    return feet.map((f) => { const x = cursor + f / 2; cursor += f; return x; });
  }, [items, sideWidths]);

  const paint = React.useCallback((i: number) => {
    const s = sim.current;
    const { h } = live.current.size;
    const w = h * ASPECT;
    const slot = slots.current[i];
    if (!slot) return;
    const angle = s.turn[i] ?? REST;
    const swing = s.swing[i] ?? 0;
    slot.style.transform = `translate3d(${((s.x[i] ?? 0) - w / 2).toFixed(2)}px,0,0)`;
    const sw = swings.current[i];
    if (sw) sw.style.transform = `rotate(${swing.toFixed(3)}deg)`;
    const e = clamp(1 - angle / REST, 0, 1);
    const tu = turns.current[i];
    const sd = sides.current[i];
    if (tu) {
      tu.style.transform = `perspective(${PERSPECTIVE}px) rotateY(${angle.toFixed(2)}deg)`;
      tu.style.opacity = sd ? clamp((e - 0.44) / 0.12, 0, 1).toFixed(3) : "1";
    }
    if (sd) {
      sd.style.opacity = clamp((0.56 - e) / 0.12, 0, 1).toFixed(3);
      sd.style.transform = `perspective(${PERSPECTIVE}px) rotateY(${(Math.min(1, e * 2) * -84).toFixed(2)}deg)`;
    }
    const lag = clamp(-(s.vswing[i] ?? 0) * 0.018, -5, 5);
    const dr = drapes.current[i];
    if (dr) dr.style.setProperty("--drape", `${lag.toFixed(3)}deg`);
    const sh = shades.current[i];
    if (sh) sh.style.setProperty("--shade", (1 - lambert(angle)).toFixed(3));
    const shadow = shadows.current[i];
    if (shadow) shadow.style.transform = `translate3d(${(w * 0.05).toFixed(1)}px, ${(h * 0.035).toFixed(1)}px, 0) scaleX(${Math.max(0.12, Math.abs(Math.cos((angle * Math.PI) / 180))).toFixed(3)})`;
    const tag = tags.current[i];
    if (tag) tag.style.transform = `rotate(${(-12 + (s.tag[i] ?? 0)).toFixed(2)}deg)`;
  }, []);

  const stepRef = React.useRef((now: number) => { void now; });
  const step = React.useCallback((now: number) => {
    const s = sim.current;
    const n = live.current.count;
    const dt = s.last ? Math.min(0.034, (now - s.last) / 1000) : 1 / 60;
    s.last = now;
    const { h, width, carousel } = live.current.size;
    let busy = false;
    const sub = 2;
    const sdt = dt / sub;
    for (let k = 0; k < sub; k++) {
      for (let i = 0; i < n; i++) {
        const before = s.vx[i] ?? 0;
        if (i !== s.drag) {
          const restoring = now > s.free;
          const stiff = restoring ? 130 : 0;
          const damp = restoring ? 2 * Math.sqrt(130) * 0.86 : 3.2;
          const ax = -stiff * ((s.x[i] ?? 0) - (s.tx[i] ?? 0)) - damp * before;
          s.vx[i] = before + ax * sdt;
          s.x[i] = (s.x[i] ?? 0) + (s.vx[i] ?? 0) * sdt;
        }
        const accel = ((s.vx[i] ?? 0) - before) / sdt;
        const ta = -150 * ((s.turn[i] ?? 0) - (s.tturn[i] ?? 0)) - 2 * Math.sqrt(150) * 0.78 * (s.vturn[i] ?? 0);
        s.vturn[i] = (s.vturn[i] ?? 0) + ta * sdt;
        s.turn[i] = (s.turn[i] ?? 0) + (s.vturn[i] ?? 0) * sdt;
        const sa = -24 * (s.swing[i] ?? 0) - 2.1 * (s.vswing[i] ?? 0) - clamp(accel, -6000, 6000) * 0.0045;
        s.vswing[i] = (s.vswing[i] ?? 0) + sa * sdt;
        s.swing[i] = clamp((s.swing[i] ?? 0) + (s.vswing[i] ?? 0) * sdt, -12, 12);
        const tagA = -46 * ((s.tag[i] ?? 0) - (s.swing[i] ?? 0) * 0.6) - 3.4 * (s.vtag[i] ?? 0) - (s.vswing[i] ?? 0) * 0.9;
        s.vtag[i] = (s.vtag[i] ?? 0) + tagA * sdt;
        s.tag[i] = clamp((s.tag[i] ?? 0) + (s.vtag[i] ?? 0) * sdt, -30, 30);
      }
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n - 1; i++) {
          const a = s.x[i] ?? 0;
          const b = s.x[i + 1] ?? 0;
          const minGap = (footprint(h, s.turn[i] ?? REST, live.current.sideWidths[i]) + footprint(h, s.turn[i + 1] ?? REST, live.current.sideWidths[i + 1])) / 2 + h * 0.012;
          const overlap = minGap - (b - a);
          if (overlap <= 0) continue;
          if (i === s.drag) s.x[i + 1] = b + overlap;
          else if (i + 1 === s.drag) s.x[i] = a - overlap;
          else { s.x[i] = a - overlap / 2; s.x[i + 1] = b + overlap / 2; }
          const va = s.vx[i] ?? 0;
          const vb = s.vx[i + 1] ?? 0;
          if (va > vb) {
            const shared = (va + vb) / 2;
            if (i !== s.drag) s.vx[i] = shared;
            if (i + 1 !== s.drag) s.vx[i + 1] = shared;
          }
        }
      }
      if (!carousel && n > 0) {
        const edge = h * 0.06;
        const first = edge + footprint(h, s.turn[0] ?? REST, live.current.sideWidths[0]) / 2;
        const last = width - edge - footprint(h, s.turn[n - 1] ?? REST, live.current.sideWidths[n - 1]) / 2;
        if ((s.x[0] ?? 0) < first) { s.x[0] = first; s.vx[0] = Math.abs(s.vx[0] ?? 0) * 0.3; }
        if ((s.x[n - 1] ?? 0) > last) { s.x[n - 1] = last; s.vx[n - 1] = -Math.abs(s.vx[n - 1] ?? 0) * 0.3; }
      }
    }
    for (let i = 0; i < n; i++) {
      paint(i);
      if (Math.abs((s.vx[i] ?? 0)) > 0.4 || (now > s.free && Math.abs((s.x[i] ?? 0) - (s.tx[i] ?? 0)) > 0.25) || Math.abs((s.turn[i] ?? 0) - (s.tturn[i] ?? 0)) > 0.05 || Math.abs(s.vturn[i] ?? 0) > 0.05 || Math.abs(s.swing[i] ?? 0) > 0.02 || Math.abs(s.vswing[i] ?? 0) > 0.05 || Math.abs((s.tag[i] ?? 0)) > 0.05 || Math.abs(s.vtag[i] ?? 0) > 0.08) busy = true;
    }
    if (s.drag >= 0 || now < s.free) busy = true;
    if (busy) s.raf = requestAnimationFrame(stepRef.current);
    else {
      s.raf = 0; s.last = 0;
      for (let i = 0; i < n; i++) { if (now > s.free) s.x[i] = s.tx[i] ?? 0; s.swing[i] = 0; s.vswing[i] = 0; s.tag[i] = 0; s.vtag[i] = 0; paint(i); }
    }
  }, [paint]);
  React.useLayoutEffect(() => { stepRef.current = step; }, [step]);

  const kick = React.useCallback(() => {
    const s = sim.current;
    if (live.current.reduced) {
      for (let i = 0; i < live.current.count; i++) { s.x[i] = s.tx[i] ?? 0; s.turn[i] = s.tturn[i] ?? REST; s.vx[i] = 0; s.vturn[i] = 0; s.swing[i] = 0; s.vswing[i] = 0; paint(i); }
      return;
    }
    if (!s.raf) { s.last = 0; s.raf = requestAnimationFrame(step); }
  }, [paint, step]);

  const impulse = React.useCallback((i: number, amount: number) => {
    const s = sim.current;
    if (live.current.reduced || i < 0 || i >= live.current.count) return;
    s.vswing[i] = (s.vswing[i] ?? 0) + amount;
    kick();
  }, [kick]);

  React.useLayoutEffect(() => {
    if (!size.width) return;
    const s = sim.current;
    // The effect above that copies state into `live` runs first, so the loop reads this render's values.
    live.current = { ...live.current, active, size, reduced, count, openIndex, sideWidths, carouselIndex: carouselAt };
    const front = size.carousel ? (active ?? carouselAt) : active;
    const xs = targets(size.h, size.width, size.carousel, front);
    const fresh = s.x.length !== count;
    for (let i = 0; i < count; i++) {
      s.tx[i] = (xs[i] ?? 0) + (size.carousel ? pointer.current.swipe : 0);
      s.tturn[i] = i === front ? 0 : REST;
      if (fresh || reduced) {
        s.x[i] = s.tx[i] ?? 0; s.vx[i] = 0; s.px[i] = 0;
        s.turn[i] = s.tturn[i] ?? REST; s.vturn[i] = 0;
        s.swing[i] = s.swing[i] ?? 0; s.vswing[i] = s.vswing[i] ?? 0; s.tag[i] = 0; s.vtag[i] = 0;
      }
    }
    if (fresh) { s.x.length = count; for (let i = 0; i < count; i++) paint(i); }
    kick();
  }, [size, active, count, reduced, openIndex, sideWidths, carouselAt, targets, paint, kick]);

  const brushed = React.useRef(false);
  React.useEffect(() => {
    if (!size.width || brushed.current || reduced) return;
    brushed.current = true;
    const timers = items.map((_, i) => window.setTimeout(() => impulse(i, 46 - i * 2.5), 120 + i * 55));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [size.width, reduced, items, impulse]);

  React.useEffect(() => {
    const s = sim.current;
    return () => { cancelAnimationFrame(s.raf); s.raf = 0; };
  }, []);

  // The lifted view is fetched the first time a pointer, a finger or the focus
  // reaches the rail, so it is there by the time the click lands.
  React.useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const kinds = ["pointerover", "touchstart", "focusin"] as const;
    const warm = () => {
      for (const kind of kinds) section.removeEventListener(kind, warm);
      void loadDetail();
    };
    for (const kind of kinds) section.addEventListener(kind, warm, { passive: true });
    return () => { for (const kind of kinds) section.removeEventListener(kind, warm); };
  }, []);

  React.useLayoutEffect(() => {
    if (openIndex !== null || lifted !== null || returnFocus.current === null) return;
    const index = returnFocus.current;
    returnFocus.current = null;
    slots.current[index]?.focus({ preventScroll: true });
  }, [openIndex, lifted]);

  const choose = React.useCallback((index: number | null) => {
    setActive((old) => {
      if (old === index) return old;
      if (index !== null) { impulse(index - 1, -30); impulse(index + 1, 30); }
      if (old !== null && old !== index) { impulse(old - 1, 14); impulse(old + 1, -14); }
      return index;
    });
    if (index !== null) setCarouselAt(index);
  }, [impulse]);

  const stop = React.useCallback(() => setPlaying(false), []);

  React.useEffect(() => {
    if (!playing || reduced || openIndex !== null || count === 0 || !size.width) return;
    let timer = 0;
    const advance = () => {
      const current = live.current.active;
      choose(current === null ? 0 : (current + 1) % live.current.count);
      timer = window.setTimeout(advance, interval);
    };
    timer = window.setTimeout(advance, active === null ? 1100 : interval);
    return () => window.clearTimeout(timer);
  }, [playing, reduced, openIndex, count, interval, size.width, choose, active]);

  const open = React.useCallback((index: number) => {
    stop();
    setActive(index);
    setOpenIndex(index);
    onOpenChange?.(index);
  }, [onOpenChange, stop]);

  const close = React.useCallback(() => {
    setOpenIndex(null);
    onOpenChange?.(null);
  }, [onOpenChange]);

  function nearest(clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage) return null;
    const box = stage.getBoundingClientRect();
    const x = clientX - box.left;
    const y = clientY - box.top;
    const { h } = live.current.size;
    if (y < 0 || y > h + 46) return null;
    const s = sim.current;
    let best = null as number | null;
    let distance = Infinity;
    for (let i = 0; i < live.current.count; i++) {
      const half = footprint(h, s.turn[i] ?? REST, live.current.sideWidths[i]) / 2 + 4;
      const d = Math.abs(x - (s.x[i] ?? 0));
      if (d < half && d < distance) { best = i; distance = d; }
    }
    return best;
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const p = pointer.current;
    const s = sim.current;
    const stage = stageRef.current;
    if (p.id === event.pointerId && stage) {
      const dx = event.clientX - p.x;
      // The event's own time: the same clock as the animation frames' timestamps.
      const now = event.timeStamp;
      if (!p.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(event.clientY - p.y)) {
        p.moved = true;
        stop();
        if (stage.isConnected) stage.setPointerCapture(event.pointerId);
        if (!live.current.size.carousel && p.index >= 0) {
          s.drag = p.index;
          s.grab = (event.clientX - stage.getBoundingClientRect().left) - (s.x[p.index] ?? 0);
        }
      }
      if (p.moved) {
        const v = (event.clientX - p.lastX) / Math.max(1, now - p.lastT);
        p.v = p.v * 0.6 + v * 0.4;
        p.lastX = event.clientX; p.lastT = now;
        if (s.drag >= 0) {
          const x = event.clientX - stage.getBoundingClientRect().left - s.grab;
          s.vx[s.drag] = p.v * 1000;
          s.x[s.drag] = x;
          s.free = now + 900;
          kick();
        } else if (live.current.size.carousel) {
          p.swipe = dx;
          const xs = targets(live.current.size.h, live.current.size.width, true, live.current.active ?? live.current.carouselIndex);
          for (let i = 0; i < live.current.count; i++) s.tx[i] = (xs[i] ?? 0) + dx;
          kick();
        }
      }
      return;
    }
    if (event.pointerType !== "mouse" || live.current.size.carousel || live.current.openIndex !== null) return;
    const hit = nearest(event.clientX, event.clientY);
    const current = live.current.active;
    if (current !== null && hit !== current) {
      const box = stage?.getBoundingClientRect();
      const keep = box ? Math.abs(event.clientX - box.left - (s.x[current] ?? 0)) < footprint(live.current.size.h, 0) / 2 + 14 : false;
      if (keep && (hit === null || Math.abs(event.clientY - (box?.top ?? 0)) < live.current.size.h + 40)) return;
    }
    if (hit !== null) { stop(); choose(hit); }
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const hit = nearest(event.clientX, event.clientY);
    const now = event.timeStamp;
    pointer.current = { id: event.pointerId, index: hit ?? -1, x: event.clientX, y: event.clientY, t: now, moved: false, kind: event.pointerType, swipe: 0, lastX: event.clientX, lastT: now, v: 0 };
  };

  const finishPointer = (event: React.PointerEvent, cancelled: boolean) => {
    const p = pointer.current;
    if (p.id !== event.pointerId) return;
    const s = sim.current;
    const stage = stageRef.current;
    if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    pointer.current = { ...p, id: -1 };
    if (s.drag >= 0) {
      s.drag = -1;
      s.free = event.timeStamp + 700;
      kick();
      return;
    }
    if (p.moved && live.current.size.carousel) {
      const dx = event.clientX - p.x;
      const current = live.current.active ?? live.current.carouselIndex;
      const step = Math.abs(dx) > 40 || Math.abs(p.v) > 0.45 ? (dx < 0 ? 1 : -1) : 0;
      pointer.current.swipe = 0;
      choose(clamp(current + step, 0, live.current.count - 1));
      for (let i = 0; i < live.current.count; i++) impulse(i, clamp(-p.v * 22, -30, 30));
      return;
    }
    if (cancelled || p.moved || p.index < 0) return;
    stop();
    const touch = p.kind !== "mouse";
    // Opened here, not on the click that follows: the hanger under the pointer
    // may have slid away (it turned to the front on hover) by the time the click
    // lands, and the click would then fall between two pieces.
    if (touch && live.current.active !== p.index) choose(p.index);
    else open(p.index);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    stop();
    const from = active ?? focusIndex;
    const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : clamp(from + (event.key === "ArrowRight" ? 1 : -1), 0, count - 1);
    setFocusIndex(next);
    choose(next);
    slots.current[next]?.focus({ preventScroll: true });
  };

  const onPointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && pointer.current.id < 0 && !size.carousel && !document.activeElement?.matches("[data-garment]:focus-visible")) choose(null);
  };

  const current = active === null ? null : items[active];
  const h = size.h;
  const boxW = h * ASPECT;
  const railY = Math.round(h * 0.07) + 10;
  const railR = Math.max(3, Math.round((RAIL_R / VB_H) * h * 10) / 10);
  // The hang-tag grows with the pieces, so a price reads at a glance on a wide rail.
  const tagFont = Math.max(10, Math.round(h * 0.032));
  const bottom = count ? Math.max(...items.map((item) => (item.image ? VB_H : SIDE[item.kind ?? "tee"].hem + 8))) / VB_H : 1;
  // A piece without a photo is drawn (railArt.tsx): only then is that chunk fetched.
  const drawn = items.some((item) => !item.image);

  return (
    <section
      {...rest}
      ref={sectionRef}
      data-slot="clothing-rail"
      data-mode={size.carousel ? "carousel" : "rail"}
      data-active={active ?? ""}
      aria-roledescription="clothing rail"
      className={`relative isolate w-full overflow-hidden text-ink ${className ?? ""}`}
    >
      <Defs uid={uid} />
      {drawn && <ArtDefs uid={uid} />}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(120% 70% at 18% 0%, color-mix(in oklab, var(--color-ink) 7%, transparent), transparent 62%), linear-gradient(to bottom, transparent 55%, color-mix(in oklab, var(--color-ink) 5%, transparent))" }} />
      {(eyebrow || heading) && (
        <header className="relative z-10 flex flex-col items-center gap-2 px-6 pt-8 text-center">
          {eyebrow && <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-ink-soft">{eyebrow}</p>}
          {heading && <h2 className="text-balance text-2xl font-medium tracking-tight text-ink sm:text-3xl">{heading}</h2>}
        </header>
      )}

      <div
        ref={stageRef}
        data-stage
        role="group"
        aria-label={heading || labels.show}
        dir="ltr"
        className="relative mt-5 w-full touch-pan-y select-none"
        style={{ height: Math.round(railY + h * bottom + h * 0.05 + 12), overflowX: "clip" }}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={(event) => finishPointer(event, false)}
        onPointerCancel={(event) => finishPointer(event, true)}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <div aria-hidden="true" data-rail className="pointer-events-none absolute inset-x-0 z-0" style={{ top: railY - railR, height: railR * 2 }}>
          <div className="absolute inset-x-0 h-3 rounded-full bg-ink/10 blur-[5px]" style={{ top: railR * 2 + 1 }} />
          <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(to bottom, color-mix(in oklab, var(--color-line-strong) 35%, white) 0%, white 18%, color-mix(in oklab, var(--color-line-strong) 70%, white) 38%, var(--color-line-strong) 62%, color-mix(in oklab, var(--color-line-strong) 55%, black) 100%)", boxShadow: "0 1px 0 color-mix(in oklab, var(--color-ink) 18%, transparent)" }} />
          <div className="absolute inset-0 rounded-full opacity-40 mix-blend-overlay" style={{ background: "repeating-linear-gradient(90deg, transparent 0 2px, color-mix(in oklab, white 40%, transparent) 2px 3px, transparent 3px 7px)" }} />
          {[0, 1].map((side) => (
            <div key={side} className="absolute top-1/2 h-7 w-4 -translate-y-1/2 rounded-[3px]" style={{ [side ? "right" : "left"]: 6, background: "linear-gradient(to right, color-mix(in oklab, var(--color-line-strong) 60%, white), var(--color-line-strong) 55%, color-mix(in oklab, var(--color-line-strong) 60%, black))", boxShadow: "0 3px 6px color-mix(in oklab, var(--color-ink) 18%, transparent)" }}>
              <span className="absolute left-1/2 top-1 size-1 -translate-x-1/2 rounded-full bg-ink/35" />
              <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-ink/35" />
            </div>
          ))}
        </div>

        {items.map((item, i) => {
          const kind = item.kind ?? "tee";
          const color = item.color ?? "var(--color-line-strong)";
          const trim = item.trim ?? mix(color, -0.12);
          const turned = active === i;
          const full = hanger === "none";
          return (
            <button
              key={item.id}
              ref={(node) => { slots.current[i] = node; }}
              type="button"
              data-garment={i}
              data-front={turned || undefined}
              tabIndex={i === (active ?? focusIndex) ? 0 : -1}
              aria-label={item.tag ? `${item.name}, ${item.tag}` : item.name}
              aria-describedby={`${uid}-caption`}
              aria-pressed={turned}
              className="absolute left-0 cursor-pointer rounded-xl outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              style={{ top: railY - (HOOK_TOP / VB_H) * h, width: boxW, height: h, zIndex: turned ? 30 : 10 + i, visibility: lifted === i ? "hidden" : undefined }}
              onFocus={() => { setFocusIndex(i); if (pointer.current.id < 0) { stop(); choose(i); } }}
              // A keyboard press opens this piece; a pointer opens it on release (finishPointer).
              onClick={(event) => { if (event.detail === 0) open(i); }}
            >
              <span ref={(node) => { swings.current[i] = node; }} className="absolute inset-0" style={{ transformOrigin: `50% ${(HOOK_TOP / VB_H) * 100}%` }}>
                <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ filter: `blur(${Math.max(3, h * 0.022).toFixed(1)}px)` }}>
                  {item.image
                    ? <span ref={(node) => { shadows.current[i] = node; }} className="absolute inset-0 block opacity-[0.16] dark:opacity-60"><Photo src={item.image} alt="" full={full} outline /></span>
                    : <span ref={(node) => { shadows.current[i] = node; }} className="absolute inset-0 block opacity-[0.16] dark:opacity-60"><DrawnMask kind={kind} side="front" /></span>}
                </span>
                {(item.sideImage || !item.image) && (
                  <span ref={(node) => { sides.current[i] = node; }} data-face="side" className="absolute inset-0" style={{ transform: `perspective(${PERSPECTIVE}px) rotateY(0deg)` }}>
                    <SideHanger uid={uid} material={hanger} />
                    {item.sideImage ? <Photo src={item.sideImage} alt="" full={full} /> : <SideArt uid={uid} kind={kind} color={color} trim={trim} />}
                  </span>
                )}
                <span ref={(node) => { turns.current[i] = node; }} data-turn className="absolute inset-0 rounded-lg [transform-style:preserve-3d]" style={{ transform: `perspective(${PERSPECTIVE}px) rotateY(${REST}deg)`, opacity: item.image && !item.sideImage ? 1 : 0 }}>
                  {(["front", "back"] as const).map((side) => (
                    <span key={side} data-face={side} className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: side === "back" ? "rotateY(180deg)" : undefined, ["--garment-color" as string]: color, ["--garment-under" as string]: mix(color, -0.42) }}>
                      {!item.image && <GarmentTop kind={kind} side={side} />}
                      <Hanger uid={uid} material={hanger} />
                      <span ref={side === "front" ? (node) => { drapes.current[i] = node; } : undefined} data-drape className="absolute inset-0 origin-top [transform:skewX(var(--drape,0deg))]" style={side === "back" ? { transform: "skewX(calc(var(--drape, 0deg) * -1))" } : undefined}>
                        {item.image
                          ? <Photo src={(side === "back" ? item.backImage : undefined) ?? item.image} alt="" full={full} />
                          : <Fabric uid={uid} kind={kind} side={side} color={color} trim={trim} />}
                        {item.image
                          ? <span ref={side === "front" ? (node) => { shades.current[i] = node; } : undefined} className="pointer-events-none absolute inset-0" style={{ opacity: "var(--shade, 0.2)" }}><Photo src={(side === "back" ? item.backImage : undefined) ?? item.image} alt="" full={full} outline /></span>
                          : <span ref={side === "front" ? (node) => { shades.current[i] = node; } : undefined} className="pointer-events-none absolute inset-0" style={{ opacity: "var(--shade, 0.2)" }}><DrawnMask kind={kind} side={side} /></span>}
                      </span>
                    </span>
                  ))}
                </span>
                {item.tag && (
                  <span ref={(node) => { tags.current[i] = node; }} aria-hidden="true" className="pointer-events-none absolute left-1/2 origin-top" style={{ top: (32 / VB_H) * h, transform: "rotate(-12deg)" }}>
                    <span className="ms-[3px] block h-[14px] w-px bg-ink/35" />
                    <span dir="auto" className="relative ms-[3px] block -translate-x-1/2 overflow-hidden whitespace-nowrap rounded-[4px] border border-ink/10 bg-paper-raised px-2 pb-1.5 pt-3 text-center leading-none text-ink shadow-[0_3px_8px_color-mix(in_oklab,var(--color-ink)_20%,transparent)]" style={{ fontSize: tagFont }}>
                      <span className="absolute inset-x-0 top-0 h-[3px] bg-primary" />
                      <span className="absolute left-1/2 top-[6px] size-[4px] -translate-x-1/2 rounded-full bg-ink/30" />
                      {item.badge && (
                        <span className={`mb-1 block rounded-[2px] px-1 py-[3px] text-[0.78em] font-bold ${item.badge.tone === "sale" ? "bg-danger text-paper-raised" : "bg-ink text-paper"}`}>{item.badge.text}</span>
                      )}
                      {item.tagWas && <span className="mb-[3px] block text-[0.78em] font-medium text-ink-soft line-through">{item.tagWas}</span>}
                      <span className="block font-bold tracking-wide">{item.tag}</span>
                    </span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {size.carousel && count > 1 && (
        <div className="relative z-10 mt-1 flex justify-center gap-1.5" role="group" aria-label={labels.show}>
          {items.map((item, i) => (
            <button key={item.id} type="button" aria-label={`${labels.show} ${item.name}`} aria-current={carouselIndex === i} onClick={() => { stop(); choose(i); }} className={`h-1.5 rounded-full outline-none transition-[width,background-color] duration-300 focus-visible:ring-2 focus-visible:ring-primary ${carouselIndex === i ? "w-6 bg-ink" : "w-1.5 bg-ink/25 hover:bg-ink/45"}`} />
          ))}
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center gap-4 px-6 pb-8 pt-4 text-center">
        <div id={`${uid}-caption`} aria-live="polite" className="min-h-[3.25rem]">
          <p key={current?.id ?? "caption"} className="text-sm font-medium text-ink">{current ? current.name : caption}</p>
          {current?.description && <p key={`${current.id}-d`} className="mx-auto mt-1 max-w-[42ch] text-[13px] leading-relaxed text-ink-soft">{current.description}</p>}
        </div>
        {action}
      </div>

      {openIndex !== null && items[openIndex] && (
        <Detail
          uid={uid}
          item={items[openIndex]}
          index={openIndex}
          total={count}
          hanger={hanger}
          labels={labels}
          reduced={reduced}
          host={sectionRef}
          source={() => turns.current[openIndex]?.getBoundingClientRect() ?? null}
          onLift={(lift) => setLifted(lift ? openIndex : null)}
          onClose={(toCart) => {
            const index = openIndex;
            // Added to the cart: the cart drawer opens and takes the focus instead of the hanger.
            if (!toCart) returnFocus.current = index;
            close();
            impulse(index, (index % 2 ? 1 : -1) * 44);
            if (toCart) cart?.openDrawer();
          }}
        />
      )}
    </section>
  );
}
