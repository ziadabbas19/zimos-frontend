import { useEffect, useRef, type CSSProperties } from "react";
import "./auth-scene.css";

/**
 * The picture beside sign in and sign up (AuthShell's `side` layout), drawn
 * in layers instead of a photograph, all decoration (aria-hidden):
 *
 * 1. the background (public/photos/auth-bg-*.webp: the navy room, its glow
 *    and floor), the one picture fetched early, with a light that breathes
 *    over it and a floor grid drifting towards the viewer;
 * 2. specks of light rising slowly;
 * 3. a phone with a store on it (public/photos/auth-phone.webp, and a
 *    400px copy for screens that draw it small), floating,
 *    a soft shadow under it that follows, and a sheen crossing its screen;
 * 4. six of the site's 3D icons (public/icons/3d) floating around it, each
 *    on its own beat;
 * 5. three glass cards with what happens to an order, coming in one after
 *    the other.
 *
 * The backdrop fills the panel; the stage is the space under the panel's
 * words (auth.css lays them out one above the other), so nothing here comes
 * over them. CSS only, transform and opacity only (auth-scene.css); with
 * reduced motion everything stands still, composed. The animations hold
 * while the tab is hidden. The phone and the icons are fetched lazily: the
 * panel is hidden below 1024px, and a lazy picture in it is never fetched.
 */

export interface AuthSceneStrings {
  newOrder: string;
  newOrderDetail: string;
  confirmed: string;
  confirmedDetail: string;
  delivered: string;
  deliveredDetail: string;
}

/** Where each icon floats on the stage (in % of it), and its own beat. */
const ICONS = [
  { name: "package", top: 3, side: "start", inset: 12, size: 15, dur: 5.2, delay: -1.2, tilt: -8 },
  { name: "chart", top: 1, side: "end", inset: 13, size: 14, dur: 6.4, delay: -3.1, tilt: 7 },
  { name: "truck", top: 44, side: "start", inset: 3, size: 15, dur: 4.6, delay: -2.4, tilt: 6 },
  { name: "check", top: 30, side: "end", inset: 4, size: 12, dur: 5.8, delay: -0.6, tilt: -6 },
  { name: "money", top: 79, side: "start", inset: 15, size: 13, dur: 6.9, delay: -4.2, tilt: 9 },
  { name: "rocket", top: 74, side: "end", inset: 10, size: 14, dur: 4.2, delay: -1.8, tilt: -10 },
] as const;

/** The specks of light: place (%), size (px) and beat, fixed so the page draws the same every time. */
const SPECKS: readonly [number, number, number, number, number][] = [
  [8, 62, 4, 9.5, -1.1],
  [14, 30, 3, 11, -6.2],
  [19, 84, 5, 8.2, -3.4],
  [24, 48, 3, 12.5, -8.8],
  [29, 70, 6, 10.4, -2.2],
  [35, 22, 4, 9.1, -5.6],
  [41, 90, 3, 13, -0.4],
  [46, 56, 5, 10.8, -7.3],
  [52, 36, 3, 8.8, -4.1],
  [57, 80, 4, 11.6, -9.5],
  [62, 18, 5, 12.2, -2.9],
  [67, 64, 3, 9.7, -6.8],
  [72, 42, 6, 10.1, -1.6],
  [78, 88, 4, 12.8, -5.1],
  [83, 26, 3, 9.3, -7.7],
  [88, 58, 5, 11.2, -3.8],
  [93, 76, 3, 10.6, -8.2],
  [97, 40, 4, 8.6, -4.6],
];

const vars = (values: Record<string, string | number>) => values as CSSProperties;

/** Layers 1: the background, its light and its floor, behind everything in the panel. */
export function AuthBackdrop() {
  return (
    <div className="auth-scene__back" aria-hidden>
      <img
        className="auth-scene__bg"
        src="/photos/auth-bg-1080.webp"
        srcSet="/photos/auth-bg-720.webp 720w, /photos/auth-bg-1080.webp 1080w"
        sizes="(min-width: 64rem) 44vw, 1px"
        width={1080}
        height={1350}
        alt=""
        decoding="async"
        fetchPriority="high"
      />
      <i className="auth-scene__glow" />
      <div className="auth-scene__floor">
        <i />
      </div>
    </div>
  );
}

/** Layers 2 to 5, on the stage under the panel's words. */
export function AuthStage({ t }: { t: AuthSceneStrings }) {
  const stage = useRef<HTMLDivElement>(null);

  // Nothing moves while the tab is hidden.
  useEffect(() => {
    const el = stage.current?.closest<HTMLElement>(".auth-split__photo");
    if (!el) return;
    const sync = () => el.toggleAttribute("data-paused", document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const cards = [
    { key: "a", tone: "new", title: t.newOrder, detail: t.newOrderDetail },
    { key: "b", tone: "ok", title: t.confirmed, detail: t.confirmedDetail },
    { key: "c", tone: "paid", title: t.delivered, detail: t.deliveredDetail },
  ];

  return (
    <div className="auth-scene__stage" ref={stage} aria-hidden>
      <div className="auth-scene__specks">
        {SPECKS.map(([x, y, size, dur, delay]) => (
          <i key={`${x}-${y}`} style={vars({ "--x": `${x}%`, "--y": `${y}%`, "--z": `${size}px`, "--t": `${dur}s`, "--w": `${delay}s` })} />
        ))}
      </div>

      <i className="auth-scene__shadow" />
      <div className="auth-scene__phone">
        <img
          src="/photos/auth-phone.webp"
          srcSet="/photos/auth-phone-400.webp 400w, /photos/auth-phone.webp 720w"
          sizes="(min-width: 64rem) 17vw, 1px"
          width={720}
          height={1262}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
        <i className="auth-scene__sheen" />
      </div>

      {ICONS.map((icon) => (
        <img
          key={icon.name}
          className={`auth-scene__icon auth-scene__icon--${icon.side}`}
          src={`/icons/3d/${icon.name}.webp`}
          width={96}
          height={96}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          style={vars({ "--top": `${icon.top}%`, "--in": `${icon.inset}%`, "--size": icon.size, "--t": `${icon.dur}s`, "--w": `${icon.delay}s`, "--tilt": `${icon.tilt}deg` })}
        />
      ))}

      {cards.map((card) => (
        <div key={card.key} className={`auth-scene__card auth-scene__card--${card.key}`}>
          <i className={`auth-scene__dot auth-scene__dot--${card.tone}`} />
          <span>
            <b>{card.title}</b>
            <small>{card.detail}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
