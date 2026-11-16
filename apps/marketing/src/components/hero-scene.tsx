import type { CSSProperties, ReactNode } from "react";
import type { HeroScene as Copy, HeroScenePop, HeroSceneTip } from "@/i18n/dictionary";

/**
 * The hero's scene (app/hero-scene.css): a light behind the words that
 * drifts, a dashed shipping route, a few stars, and
 * sixteen objects a visitor can tap — boxes, coins, price tags, a bag, a
 * check, a rocket, a bell, a chat, a review and a truck. Each tap plays the
 * object's own answer and its word, and a small tally counts the orders, the
 * reviews and the money. Decoration only: hidden from screen readers, never
 * reached with the keyboard.
 *
 * No script: a server component. Each object is a <label> holding a hidden
 * checkbox; checking it plays the answer (`:checked`), unchecking it puts the
 * object back, and the tally is a CSS counter over the labels whose box is
 * checked (`:has(:checked)`: Chrome recounts on that, not on the box itself). The
 * desktop places come from the list below; on a phone and a tablet five of
 * the objects stand on a shelf over the devices (`shelf`) and the rest are
 * left out.
 */

type Kind = "cube" | "coin" | "tag" | "bag" | "ok" | "rocket" | "bell" | "chat" | "rev" | "truck";

interface Thing {
  kind: Kind;
  pop: HeroScenePop;
  tip: HeroSceneTip;
  /** From 1024px up: the side it stands on (start or end), its distance from that edge and from the top, in % of the hero (never under the header). */
  at: ["s" | "e", number, number];
  /** Its size in the scene's unit (`em`), for the boxes and the coins. */
  size?: number;
  /** Below 1024px, one of the five on the shelf: its distance from the start edge (%), its height over the devices and its size (em), its tilt (deg). */
  shelf?: [number, number, number, number];
  /** What a tap adds to the tally: an order, an amount in EGP, a review. */
  adds?: { n?: number; v?: number; r?: number };
  tone?: "gold" | "cyan";
  /** Which of the two price tags' words it carries. */
  text?: 0 | 1;
  /** Shown from 1280px up only: at 1024–1279px the words and the devices leave no room for it. */
  wide?: boolean;
  /** Its tap sends rings out (the check, the bell, the chat). */
  rings?: boolean;
}

const THINGS: Thing[] = [
  { kind: "cube", pop: "order1", tip: "box", at: ["s", 7, 16], size: 9.6, shelf: [3, 3.4, 5.6, -10], wide: true, adds: { n: 1, v: 1250 } },
  { kind: "coin", pop: "profit3", tip: "profit", at: ["s", 2.5, 28], size: 3.8, wide: true, adds: { v: 240 } },
  { kind: "bell", pop: "bell", tip: "notifications", at: ["s", 16.5, 28], shelf: [24, -2.6, 4.4, 8], wide: true, rings: true },
  { kind: "chat", pop: "chat", tip: "message", at: ["s", 2.5, 38], wide: true, rings: true },
  { kind: "coin", pop: "profit1", tip: "profit", at: ["s", 4, 50], size: 4.4, adds: { v: 120 } },
  { kind: "cube", pop: "order3", tip: "box", at: ["s", 6, 61], size: 5.4, tone: "gold", wide: true, adds: { n: 1, v: 1650 } },
  { kind: "truck", pop: "truck", tip: "ship", at: ["s", 2, 73] },
  { kind: "tag", pop: "tag1", tip: "discount", at: ["s", 4, 85], text: 0 },
  { kind: "cube", pop: "order4", tip: "box", at: ["e", 12, 15], size: 4.2, tone: "cyan", shelf: [84, -2.4, 4, 10], wide: true, adds: { n: 1, v: 450 } },
  { kind: "coin", pop: "profit2", tip: "profit", at: ["e", 5, 15], size: 3.4, adds: { v: 85 } },
  { kind: "ok", pop: "ok", tip: "confirm", at: ["e", 14, 27], shelf: [47, 5.4, 4, 0], wide: true, rings: true },
  { kind: "cube", pop: "order2", tip: "box", at: ["e", 5, 25], size: 7, adds: { n: 1, v: 890 } },
  { kind: "rev", pop: "review", tip: "reviews", at: ["e", 4, 40], adds: { r: 1 } },
  { kind: "bag", pop: "bag", tip: "cart", at: ["e", 2.5, 52] },
  { kind: "rocket", pop: "rocket", tip: "publish", at: ["e", 8.5, 64], shelf: [63, 0.6, 5.2, -6] },
  { kind: "tag", pop: "tag2", tip: "price", at: ["e", 2.5, 76], text: 1 },
];

/**
 * Where the stars twinkle: the side, % from that side, % from the top; and
 * for the first four, which stay on a phone, their place there (% from the
 * start side, height over the devices in the scene's unit).
 */
const STARS: ["s" | "e", number, number, number?, number?][] = [
  ["s", 12, 36, 7, 11.5],
  ["e", 12, 46, 9, 9.5],
  ["s", 30, 12, 37, 0.6],
  ["e", 10, 13, 30, 8],
  ["s", 26, 52],
  ["s", 9, 64],
  ["e", 24, 60],
  ["e", 30, 10],
  ["s", 3, 30],
];

/** The route across the scene, in a 1000 × 600 box stretched to it. */
const ROUTE = "M-20 470C160 330 300 520 470 400S760 150 1020 260";

const vars = (values: Record<string, string | number | undefined>) => values as CSSProperties;

export function HeroScene({ copy }: { copy: Copy }) {
  return (
    <>
      <div className="zs-bg" aria-hidden>
        <i className="zs-mesh" />
        <svg className="zs-route" viewBox="0 0 1000 600" preserveAspectRatio="none">
          <path d={ROUTE} fill="none" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {STARS.map(([side, x, y, qx, qb], i) => (
          <i
            key={i}
            className={`zs-star${side === "e" ? " zs-e" : ""}${qx === undefined ? " zs-d" : ""}`}
            style={vars({ "--x": `${x}%`, "--y": `${y}%`, "--d": `${(1.2 + i * 0.8).toFixed(1)}s`, "--qx": qx !== undefined ? `${qx}%` : undefined, "--qb": qb !== undefined ? `${qb}em` : undefined })}
          />
        ))}
      </div>

      <div className="zs" aria-hidden>
        {THINGS.map((thing, i) => {
          const { kind, at, shelf, adds, size, tone } = thing;
          const className = ["zs-fl", `zk-${kind}`, at[0] === "e" && "zs-e", shelf ? "zs-q" : "zs-d", thing.wide && "zs-w", thing.rings && "zr", tone && `zs-${tone}`].filter(Boolean).join(" ");
          return (
            <label
              key={i}
              className={className}
              data-pop={copy.pops[thing.pop]}
              data-tip={copy.tips[thing.tip]}
              style={vars({
                "--d": `${(1.2 + ((i * 0.53) % 2.2)).toFixed(2)}s`,
                "--x": `${at[1]}%`,
                "--y": `${at[2]}%`,
                "--z": kind === "cube" || kind === "coin" ? `${size}em` : undefined,
                "--qx": shelf && `${shelf[0]}%`,
                "--qb": shelf && `${shelf[1]}em`,
                "--qz": shelf && `${shelf[2]}em`,
                "--qr": shelf && `${shelf[3]}deg`,
                "--n": adds?.n,
                "--v": adds?.v,
                "--r": adds?.r,
              })}
            >
              <input type="checkbox" className="zs-i" tabIndex={-1} />
              <span className="zs-in">{shape(thing, copy)}</span>
            </label>
          );
        })}

        <p className="zs-stat" data-t={copy.stat.today} data-o={copy.stat.orders} data-r={copy.stat.reviews} data-b={copy.stat.before} data-a={copy.stat.after} />
        <p className="zs-hint">{copy.hint}</p>
      </div>
    </>
  );
}

function shape(thing: Thing, copy: Copy): ReactNode {
  switch (thing.kind) {
    case "cube":
      return (
        <span className="zs-cube">
          {[0, 1].map((face) => (
            <i key={face} style={vars({ "--r": `${face * 90}deg` })} />
          ))}
        </span>
      );
    case "coin":
      return <i className="zs-coin">{copy.coin}</i>;
    case "tag":
      // dir="auto": "-20%" reads left to right on the Arabic page too.
      return (
        <i className="zs-tag" dir="auto">
          {copy.tags[thing.text ?? 0]}
        </i>
      );
    case "bag":
      return <i className="zs-bag" />;
    case "ok":
      return <i className="zs-ok" />;
    case "rocket":
      return <i className="zs-rocket" />;
    case "bell":
      return (
        <i className="zs-bell">
          <svg viewBox="0 0 24 24" width="52%" fill="#fff">
            <path d="M12 3a6 6 0 0 0-6 6v4.2L4 16.5h16l-2-3.3V9a6 6 0 0 0-6-6Zm-2.4 15a2.4 2.4 0 0 0 4.8 0Z" />
          </svg>
        </i>
      );
    case "chat":
      return (
        <span className="zs-chat">
          <b>{copy.chat.title}</b>
          <small>{copy.chat.detail}</small>
        </span>
      );
    case "rev":
      return (
        <span className="zs-rev">
          {[0, 1, 2, 3, 4].map((star) => (
            <i key={star} style={vars({ "--i": star })} />
          ))}
        </span>
      );
    case "truck":
      return (
        <span className="zs-truck">
          ZIMOS
          <i />
          <i />
        </span>
      );
  }
}
