/**
 * Every light / dark switch of the platform (the marketing site, the stores,
 * the dashboard and the console), drawn as a circle: the page in its new
 * theme grows over the old one from the point the switch was pressed until it
 * covers the screen.
 *
 * It is the View Transitions API's own picture of the page. The browser keeps
 * a still of the page as it was, the theme changes underneath, and the live
 * page in the new theme shows through a circle that widens over that still.
 * Nothing about the theme itself changes here: `applyTheme` is the switch's
 * own code, run inside the transition, so storage, the pre-paint script and
 * every listener see what they saw before.
 *
 * Where the browser has no view transitions (before Safari 18 / Chrome 111),
 * or the person asked for less motion, `applyTheme` simply runs at once.
 */

/** What the circle needs from the click: where it landed, and the button it landed on. */
export interface RevealTrigger {
  clientX: number;
  clientY: number;
  /** The click count; 0 when the click came from the keyboard (Enter / Space) or from a script. */
  detail: number;
  currentTarget: EventTarget | null;
}

export interface RevealPoint {
  x: number;
  y: number;
}

export interface RevealViewport {
  width: number;
  height: number;
}

export const REVEAL_DURATION_MS = 600;
export const REVEAL_EASING = "ease-in-out";
/** On <html> while a circle is growing. */
export const REVEAL_ATTRIBUTE = "data-theme-reveal";

const KEYFRAMES = "zimos-theme-reveal";

type ViewTransitionLike = {
  finished: Promise<void>;
  skipTransition?: () => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionLike;
};

/**
 * Where the circle starts: the pointer or the finger, else (keyboard, script)
 * the middle of the button, else the middle of the screen.
 */
export function revealOrigin(trigger: RevealTrigger | null | undefined, viewport: RevealViewport): RevealPoint {
  if (trigger && trigger.detail > 0 && Number.isFinite(trigger.clientX) && Number.isFinite(trigger.clientY)) {
    return { x: trigger.clientX, y: trigger.clientY };
  }
  const target = trigger?.currentTarget as Element | null | undefined;
  if (target && typeof target.getBoundingClientRect === "function") {
    const box = target.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

/** The circle's last radius: the distance to the farthest corner of the screen. */
export function revealRadius(origin: RevealPoint, viewport: RevealViewport): number {
  return Math.hypot(Math.max(origin.x, viewport.width - origin.x), Math.max(origin.y, viewport.height - origin.y));
}

/**
 * The zoom <html> is drawn at (the marketing site: 90% from 601px). The
 * circle's pseudo-elements inherit it, so their lengths come out that many
 * times smaller on the screen than the click's.
 */
export function rootZoom(root: HTMLElement): number {
  const current = (root as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  const zoom = typeof current === "number" ? current : parseFloat(getComputedStyle(root).zoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

/** The browser can draw the circle and the person hasn't asked for less motion. */
export function canRevealThemeChange(): boolean {
  if (typeof document === "undefined") return false;
  if (typeof (document as ViewTransitionDocument).startViewTransition !== "function") return false;
  return !(typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/** The rules of one circle, alive only while it grows. */
export function revealCss(origin: RevealPoint, radius: number): string {
  const at = `at ${Math.round(origin.x)}px ${Math.round(origin.y)}px`;
  const busy = `:root[${REVEAL_ATTRIBUTE}]`;
  return [
    // The still of the old page stays whole underneath; the new page shows only through the circle.
    "::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}",
    `::view-transition-new(root){animation:${KEYFRAMES} ${REVEAL_DURATION_MS}ms ${REVEAL_EASING} both}`,
    // One picture of the whole page, old and new: a part named for the dashboard's page moves
    // (its toolbar, dock, page) would otherwise be drawn apart from the root, outside the circle.
    ":root *{view-transition-name:none!important}",
    `@keyframes ${KEYFRAMES}{from{clip-path:circle(0px ${at})}to{clip-path:circle(${Math.ceil(radius)}px ${at})}}`,
    // The page's own colour transitions (buttons, cards) would otherwise fade from the old colours inside the circle.
    `${busy},${busy} *,${busy} *::before,${busy} *::after{transition:none!important}`,
  ].join("\n");
}

let running = false;

/**
 * Runs `applyTheme` (the switch's own code) with the circle drawn from
 * `trigger` — the click's event — or at once where no circle can be drawn.
 * A press while a circle is still growing is let go: the theme it would
 * switch is still being drawn.
 */
export function animateThemeChange(trigger: RevealTrigger | null | undefined, applyTheme: () => void): void {
  if (running) return;
  if (!canRevealThemeChange()) {
    applyTheme();
    return;
  }

  const doc = document as ViewTransitionDocument;
  const root = doc.documentElement;
  // Both, for a phone whose bars come and go: the circle may outgrow the screen, never fall short of it.
  const viewport = {
    width: Math.max(window.innerWidth, root.clientWidth),
    height: Math.max(window.innerHeight, root.clientHeight),
  };
  // Read now: the event's currentTarget is gone once the handler returns.
  const origin = revealOrigin(trigger, viewport);
  const radius = revealRadius(origin, viewport);
  const zoom = rootZoom(root);
  const style = doc.createElement("style");
  style.textContent = revealCss({ x: origin.x / zoom, y: origin.y / zoom }, radius / zoom);
  doc.head.appendChild(style);
  running = true;

  let safety = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(safety);
    style.remove();
    root.removeAttribute(REVEAL_ATTRIBUTE);
    running = false;
  };

  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition!(() => {
      root.setAttribute(REVEAL_ATTRIBUTE, "");
      applyTheme();
    });
  } catch {
    finish();
    applyTheme();
    return;
  }
  // Settles once the circle is drawn, or the browser gave the transition up (the theme is applied either way).
  transition.finished.catch(() => undefined).finally(finish);
  // Never a switch that stops answering, whatever the browser does with the transition.
  safety = window.setTimeout(() => {
    transition.skipTransition?.();
    finish();
  }, REVEAL_DURATION_MS + 3000);
}
