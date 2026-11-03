"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary } from "@/components/ui";
import { useOptionalCart } from "@/lib/CartProvider";
import type { ClothingRailLabels, RailGarment } from "./ClothingRail";
import { Fabric, GarmentTop, Hanger, Photo } from "./railParts";
import { clamp, HOOK_TOP, mix, VB_H } from "./railGeometry";

/**
 * A piece lifted off the rail (ClothingRail.tsx): turned by a drag, its back
 * shown, and bought from here. Its own chunk, fetched once the shopper's
 * pointer, finger or focus reaches the rail — ahead of the first click.
 */
export function Detail({ uid, item, index, total, hanger, labels, reduced, host, source, onLift, onClose }: {
  uid: string;
  item: RailGarment;
  index: number;
  total: number;
  hanger: "wood" | "matte" | "none";
  labels: ClothingRailLabels;
  reduced: boolean;
  /** The rail's own section: the dialog opens inside the store's wrapper around it, so it keeps the store's colours and direction. */
  host: React.RefObject<HTMLElement | null>;
  source: () => DOMRect | null;
  onLift: (lifted: boolean) => void;
  /** `toCart`: closed because the piece went into the cart. */
  onClose: (toCart?: boolean) => void;
}) {
  const dialogRef = React.useRef(null as HTMLDivElement | null);
  const figureRef = React.useRef(null as HTMLDivElement | null);
  const spinRef = React.useRef(null as HTMLDivElement | null);
  const closeRef = React.useRef(null as HTMLButtonElement | null);
  const [side, setSide] = React.useState("front" as "front" | "back");
  const [shown, setShown] = React.useState(false);
  const angle = React.useRef({ value: 0, target: 0, velocity: 0, raf: 0, last: 0, dragging: false, startX: 0, startAngle: 0 });
  const closing = React.useRef(false);
  const kind = item.kind ?? "tee";
  const color = item.color ?? "var(--color-line-strong)";
  const trim = item.trim ?? mix(color, -0.12);
  const titleId = `${uid}-detail-title`;
  const [target] = React.useState(() => host.current?.closest<HTMLElement>(".brand-theme") ?? document.body);

  const spin = React.useCallback(() => {
    const a = angle.current;
    const node = spinRef.current;
    const loop = (now: number) => {
      const dt = a.last ? Math.min(0.034, (now - a.last) / 1000) : 1 / 60;
      a.last = now;
      const accel = -90 * (a.value - a.target) - 2 * Math.sqrt(90) * 0.82 * a.velocity;
      a.velocity += accel * dt;
      a.value += a.velocity * dt;
      if (node) node.style.transform = `rotateY(${a.value.toFixed(2)}deg)`;
      if (Math.abs(a.value - a.target) < 0.05 && Math.abs(a.velocity) < 0.05) { a.value = a.target; if (node) node.style.transform = `rotateY(${a.value}deg)`; a.raf = 0; a.last = 0; return; }
      a.raf = requestAnimationFrame(loop);
    };
    if (reduced) { a.value = a.target; if (node) node.style.transform = `rotateY(${a.value}deg)`; return; }
    if (!a.raf) a.raf = requestAnimationFrame(loop);
  }, [reduced]);

  const turnTo = React.useCallback((next: "front" | "back") => {
    const a = angle.current;
    const base = Math.round(a.value / 360) * 360;
    a.target = base + (next === "back" ? 180 : 0);
    if (Math.abs(a.target - a.value) > 180) a.target -= 360 * Math.sign(a.target - a.value);
    setSide(next);
    spin();
  }, [spin]);

  React.useLayoutEffect(() => {
    const figure = figureRef.current;
    const from = source();
    const spinning = angle.current;
    closeRef.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let animation = null as Animation | null;
    if (figure && from && !reduced && from.width > 0) {
      const to = figure.getBoundingClientRect();
      const scale = from.height / to.height;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top - to.top;
      const lift = Math.min(90, Math.abs(dy) * 0.25 + 30);
      onLift(true);
      animation = figure.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - lift}px) scale(${(scale + 1) / 2 * 1.03}) rotate(${dx > 0 ? -2.5 : 2.5}deg)`, offset: 0.5 },
        { transform: "none" },
      ], { duration: 680, easing: "cubic-bezier(.22,.85,.3,1)" });
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => { cancelAnimationFrame(raf); animation?.cancel(); document.body.style.overflow = overflow; cancelAnimationFrame(spinning.raf); onLift(false); };
  }, [source, reduced, onLift]);

  const dismiss = React.useCallback((toCart = false) => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    const figure = figureRef.current;
    const to = source();
    if (!figure || !to || reduced || to.width === 0) { onClose(toCart); return; }
    const from = figure.getBoundingClientRect();
    const scale = to.height / from.height;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top - from.top;
    const animation = figure.animate([
      { transform: "none" },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 30}px) scale(${(scale + 1) / 2})`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    ], { duration: 560, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
    // Closed when the flight ends — or a moment after, should the animation never
    // run (a tab sent to the background): an invisible dialog must not stay on the page.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onClose(toCart);
    };
    animation.onfinish = finish;
    window.setTimeout(finish, 700);
  }, [source, reduced, onClose]);

  // Buying from here: the choices start on the first variant in stock; picking a
  // value no in-stock variant pairs with the other picks moves them to one that does.
  const cart = useOptionalCart();
  const buy = cart ? item.buy : undefined;
  const [picked, setPicked] = React.useState<Record<string, string>>(() => {
    const first = buy?.variants.find((v) => v.inStock) ?? buy?.variants[0];
    return { ...(first?.values ?? {}) };
  });
  const [status, setStatus] = React.useState("idle" as "idle" | "loading" | "added" | "error");
  const variant = buy?.variants.find((v) => buy.groups.every((g) => v.values[g.name] === picked[g.name]));
  const price = variant?.price ?? item.tag;
  const was = variant ? variant.was : item.tagWas;
  const soldOut = (name: string, value: string) => !buy?.variants.some((v) => v.inStock && v.values[name] === value);
  const pick = (name: string, value: string) => {
    if (!buy) return;
    const next = { ...picked, [name]: value };
    const exact = buy.variants.find((v) => v.inStock && buy.groups.every((g) => v.values[g.name] === next[g.name]));
    const other = exact ? undefined : buy.variants.find((v) => v.inStock && v.values[name] === value);
    setPicked(other ? { ...other.values } : next);
    setStatus("idle");
  };
  const add = async () => {
    if (!buy || !variant || !variant.inStock || status === "loading") return;
    setStatus("loading");
    try {
      await cart!.addItem(variant.id, buy.offerId, 1);
      setStatus("added");
      // A moment to read "added", then the piece goes back and the cart opens.
      window.setTimeout(() => dismiss(true), 650);
    } catch {
      setStatus("error");
    }
  };

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(event.target as Node)) return;
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") turnTo(side === "front" ? "back" : "front");
      else if (event.key === "Tab") { const first = dialog.querySelector<HTMLElement>("button, a[href]"); if (first) { event.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss, turnTo, side]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { turnTo(side === "front" ? "back" : "front"); return; }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? [])].filter((node) => !(node as HTMLButtonElement).disabled);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const stage = (
    <div ref={figureRef} dir="ltr" className="relative mx-auto aspect-[200/310] h-[min(62vh,560px)] max-h-full origin-top">
      <div aria-hidden="true" className="absolute left-1/2 top-[-40vh] h-[40vh] w-[3px] -translate-x-1/2 rounded-full" style={{ background: "linear-gradient(to right, color-mix(in oklab, var(--color-line-strong) 50%, white), var(--color-line-strong), color-mix(in oklab, var(--color-line-strong) 50%, black))", top: `calc(-40vh + ${(HOOK_TOP / VB_H) * 100}%)` }} />
      <div
        className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
        style={{ perspective: "1400px" }}
        onPointerDown={(event) => { const a = angle.current; a.dragging = true; a.startX = event.clientX; a.startAngle = a.value; cancelAnimationFrame(a.raf); a.raf = 0; a.last = 0; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { const a = angle.current; if (!a.dragging) return; a.value = clamp(a.startAngle + (event.clientX - a.startX) * 0.45, a.startAngle - 220, a.startAngle + 220); if (spinRef.current) spinRef.current.style.transform = `rotateY(${a.value.toFixed(2)}deg)`; }}
        onPointerUp={() => { const a = angle.current; if (!a.dragging) return; a.dragging = false; const facing = (((a.value % 360) + 360) % 360); turnTo(facing > 90 && facing < 270 ? "back" : "front"); }}
        onPointerCancel={() => { angle.current.dragging = false; turnTo(side); }}
      >
        <div ref={spinRef} className="absolute inset-0 [transform-style:preserve-3d]">
          {(["front", "back"] as const).map((face) => (
            <div key={face} className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: face === "back" ? "rotateY(180deg)" : undefined, ["--garment-color" as string]: color, ["--garment-under" as string]: mix(color, -0.42) }}>
              {!item.image && <GarmentTop kind={kind} side={face} />}
              <Hanger uid={uid} material={hanger} />
              {item.image
                ? <Photo src={(face === "back" ? item.backImage : undefined) ?? item.image} alt={face === "front" ? item.name : ""} full={hanger === "none"} />
                : <Fabric uid={uid} kind={kind} side={face} color={color} trim={trim} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-6 text-ink" onKeyDown={onKeyDown}>
      <div aria-hidden="true" className={`absolute inset-0 bg-paper/90 backdrop-blur-xl transition-opacity duration-300 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`} onClick={() => dismiss()} />
      <button ref={closeRef} type="button" onClick={() => dismiss()} className={`absolute end-5 top-5 z-10 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide text-ink-soft outline-none transition-[opacity,color] duration-300 hover:text-ink focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}>
        {labels.close}
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
      </button>
      <div className="relative grid w-full max-w-5xl items-center gap-10 pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {stage}
        <div className={`flex flex-col gap-4 text-center transition-[opacity,transform] delay-150 duration-500 motion-reduce:transition-none md:text-start ${shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
          <p className="font-mono text-[11px] tracking-[0.2em] text-ink-soft" dir="ltr">{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</p>
          <h3 id={titleId} className="text-2xl font-medium tracking-tight text-ink sm:text-3xl">{item.name}</h3>
          {price && (
            <p className="flex items-baseline justify-center gap-2 md:justify-start">
              <span className="text-lg font-semibold text-ink">{price}</span>
              {was && <s className="text-sm text-ink-soft">{was}</s>}
            </p>
          )}
          {item.description && <p className="text-sm leading-relaxed text-ink-soft">{item.description}</p>}
          {!buy && item.details && item.details.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2 md:justify-start">
              {item.details.map((detail) => <li key={detail} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft">{detail}</li>)}
            </ul>
          )}
          <div role="group" aria-label={`${labels.front} / ${labels.back}`} className="mt-2 inline-flex justify-center gap-6 md:justify-start">
            {(["front", "back"] as const).map((face) => (
              <button key={face} type="button" aria-pressed={side === face} onClick={() => turnTo(face)} className={`relative pb-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${side === face ? "text-ink" : "text-ink-soft hover:text-ink"}`}>
                {face === "front" ? labels.front : labels.back}
                <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-px origin-left bg-ink transition-transform duration-300 motion-reduce:transition-none ${side === face ? "scale-x-100" : "scale-x-0"}`} />
              </button>
            ))}
          </div>
          {buy ? (
            <>
              {buy.groups.map((group) => (
                <div key={group.name} className="flex flex-col gap-2">
                  <p className="text-xs text-ink-soft">
                    {group.name}
                    {picked[group.name] ? <span className="font-semibold text-ink">: {picked[group.name]}</span> : null}
                  </p>
                  <div role="group" aria-label={group.name} className="flex flex-wrap justify-center gap-2 md:justify-start">
                    {group.values.map((value) => {
                      const on = picked[group.name] === value;
                      const out = soldOut(group.name, value);
                      const swatch = group.swatches?.[value];
                      return swatch ? (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={on}
                          aria-label={value}
                          title={value}
                          disabled={out}
                          onClick={() => pick(group.name, value)}
                          className={`size-8 rounded-full border border-ink/15 outline-none ring-offset-2 ring-offset-paper transition-shadow focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-35 ${on ? "ring-2 ring-ink" : ""}`}
                          style={{ background: swatch }}
                        />
                      ) : (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={on}
                          disabled={out}
                          onClick={() => pick(group.name, value)}
                          className={`min-w-11 rounded-full border px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${on ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-2 flex flex-col items-center gap-2 md:items-start">
                <button type="button" onClick={add} disabled={!variant || !variant.inStock || status === "loading"} aria-busy={status === "loading"} className={`${btnPrimary} min-w-48`}>
                  <span aria-live="polite">
                    {status === "loading" ? labels.adding : status === "added" ? labels.added : variant && variant.inStock ? labels.addToCart : labels.outOfStock}
                  </span>
                </button>
                {status === "error" ? <p role="alert" className="text-sm text-danger">{labels.addFailed}</p> : null}
                {item.href ? (
                  <StoreLink href={item.href} className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                    {labels.view}
                  </StoreLink>
                ) : null}
              </div>
            </>
          ) : item.href ? (
            <div className="mt-2">
              <StoreLink href={item.href} className={btnPrimary}>
                {labels.view}
              </StoreLink>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    target,
  );
}
