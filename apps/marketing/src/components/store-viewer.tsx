"use client";

/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { GALLERY, OWN_LOOKS, galleryShot } from "@/lib/store-shots";
import { Arrow, X } from "./duo-icons";

type Device = "desk" | "phone";

/**
 * One store of the gallery, large (store-showcase.tsx opens it, and this
 * file is only fetched then): its whole home page on a computer or on a
 * phone to scroll through, the store before and after it among the ones the
 * gallery is filtered to, and the way in from it.
 *
 * A native modal <dialog>: the browser keeps the focus inside it, Esc
 * closes it and the page behind stays still (home.css). The arrow keys go
 * to the next and the previous store, the other way round in Arabic. A
 * click on the dark around it closes it too.
 */
export function StoreViewer({
  copy,
  locale,
  list,
  at,
  onMove,
  onClose,
}: {
  copy: Dictionary["templates"];
  locale: Locale;
  /** The gallery's stores the viewer goes through, by their place in GALLERY. */
  list: number[];
  /** The store open, by its place in GALLERY; null while closed. */
  at: number | null;
  onMove: (to: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Device>("desk");
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (at !== null && !el.open) el.showModal?.();
    if (at === null && el.open) el.close?.();
  }, [at]);

  // A new store, or the other device, starts at the top of its page.
  useEffect(() => {
    scroller.current?.scrollTo?.({ top: 0 });
  }, [at, device]);

  const store = at === null ? null : GALLERY[at];
  const step = (by: number) => {
    if (at === null || list.length === 0) return;
    const pos = Math.max(0, list.indexOf(at));
    onMove(list[(pos + by + list.length) % list.length]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    const by = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!by || (event.target as HTMLElement).closest(".zm-mbody")) return;
    event.preventDefault();
    step(document.documentElement.dir === "rtl" ? -by : by);
  };

  const label = (look: string) => (OWN_LOOKS.includes(look) ? copy.ownBadge : copy.templateLabel.replace("{n}", look));

  return (
    <dialog
      ref={dialog}
      className="zm-viewer"
      aria-labelledby={titleId}
      onClose={() => {
        setDevice("desk");
        onClose();
      }}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      {store ? (
        <div className="zm-mbox">
          <div className="zm-mtop">
            <h3 id={titleId}>
              {copy.names[store.look]}
              <small>
                {copy.kinds[store.kind]} · {label(store.look)}
              </small>
            </h3>
            <div className="zm-seg" role="group" aria-label={copy.viewerLabel}>
              <button type="button" aria-pressed={device === "desk"} onClick={() => setDevice("desk")}>
                {copy.onComputer}
              </button>
              <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}>
                {copy.onPhone}
              </button>
            </div>
            <button type="button" className="zm-navbtn" aria-label={copy.close} onClick={() => dialog.current?.close()}>
              <X size={18} />
            </button>
          </div>

          <div className="zm-mbody" ref={scroller} tabIndex={0}>
            <div key={`${store.look}-${device}`} className={device === "phone" ? "zm-shot zm-shot--phone" : "zm-shot"}>
              <img
                src={galleryShot(store.look, locale, device, "full")}
                width={device === "phone" ? 520 : 1200}
                alt={`${copy.names[store.look]} — ${device === "phone" ? copy.onPhone : copy.onComputer}`}
                decoding="async"
              />
            </div>
          </div>

          <div className="zm-mfoot">
            <div>
              <button type="button" className="zm-navbtn" aria-label={copy.previous} onClick={() => step(-1)}>
                <Arrow size={18} className="zm-arr zm-arr--back" />
              </button>
              <button type="button" className="zm-navbtn" aria-label={copy.next} onClick={() => step(1)}>
                <Arrow size={18} className="zm-arr" />
              </button>
              <span>{copy.scrollHint}</span>
            </div>
            <a href={REGISTER_URL} className="zm-btn zm-btn--blue zm-btn--sm">
              {copy.useTemplate}
              <Arrow size={15} className="zm-arr" />
            </a>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
