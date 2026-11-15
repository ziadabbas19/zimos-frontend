"use client";

import { Suspense, lazy, type ComponentType } from "react";

/*
 * The home page's interactive sections below the fold, each in a chunk of
 * its own that the first load does not wait for.
 *
 * On the server they render in full, so every word is in the page's HTML.
 * In the browser their code is fetched only once the page has loaded and
 * gone idle, or at the visitor's first scroll, touch or key, whichever
 * comes first; until then React keeps the server's HTML where it is
 * (a Suspense boundary that has not hydrated yet), and hydrates the
 * section when its code arrives. `next/dynamic` alone would split them
 * too, but a section it renders on the server is fetched with the page's
 * first scripts, since it has to hydrate with them.
 *
 * What works before that is what HTML does by itself: the links, and the
 * pricing's monthly / yearly switch (radio inputs and CSS).
 */

let ready: Promise<void> | null = null;

/** Resolves once the page has loaded and gone idle, or at the first scroll, touch or key. */
function afterLoad(): Promise<void> {
  ready ??= new Promise<void>((resolve) => {
    const events = ["scroll", "pointerdown", "keydown", "touchstart"] as const;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      events.forEach((type) => window.removeEventListener(type, go, true));
      resolve();
    };
    events.forEach((type) => window.addEventListener(type, go, { capture: true, passive: true }));
    const idle = () => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(go, { timeout: 2000 });
      else window.setTimeout(go, 1200);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
  return ready;
}

function island<P extends object>(load: () => Promise<ComponentType<P>>) {
  const Lazy = lazy(async () => {
    if (typeof window !== "undefined") await afterLoad();
    return { default: await load() };
  });
  function Island(props: P) {
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  return Island;
}

export const OrderJourney = island(() => import("./order-journey").then((m) => m.OrderJourney));
export const DashboardShow = island(() => import("./dashboard-show").then((m) => m.DashboardShow));
export const HomePlans = island(() => import("./home-plans").then((m) => m.HomePlans));
