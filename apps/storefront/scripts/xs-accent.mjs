/**
 * A store's own brand colour on the imported templates ("xs" looks), worked
 * out from their stylesheets when the looks are built (scripts/xs-look-css.mjs),
 * the same way their dark mode is (scripts/xs-dark.mjs).
 *
 * A look names its accent in tokens (--xs-brand, --xs-button…), and
 * app/xs-shell.css points those at the store's colour. What tokens can't reach
 * is everything a template wrote down as a plain colour: its second palette
 * (--uo-teal), a darker hover, a tinted shadow under a button. For each of
 * those this writes one more rule, inert until the store wrapper says the
 * merchant chose a colour, so a store still on the template's own colour is
 * drawn exactly as it was:
 *
 *   the accent itself           → the store's colour;
 *   any other colour with a hue → the store's hue at that colour's own
 *                                 lightness and chroma, so a dark band stays a
 *                                 dark band and a pale tint stays pale;
 *   words on an accent ground   → the store's readable label colour;
 *   a main button in the look's ink or dark → the store's colour, a shade
 *                                 darker under the pointer.
 *
 * Left alone: greys, pictures, and colours that mean something by themselves
 * (errors, stars, a social network's own colour).
 *
 * `data-xs-own-accent` says the light-mode colour is the merchant's and
 * `data-xs-own-accent-dark` the dark-mode one (lib/xsShell.ts), so a merchant
 * who only picked a dark-mode colour keeps the template's palette in light mode.
 */
import postcss from "postcss";
import { ACCENT_TOKENS, NATIVE_DARK_LOOKS, luminance, parseColor } from "../src/lib/xsDarkPalette.mjs";

export const OWN_LIGHT = '.brand-theme[data-xs-own-accent]:not([data-color-mode="dark"])';
export const OWN_DARK = '.brand-theme[data-xs-own-accent-dark][data-color-mode="dark"]';

/** The browsers that can take a colour's hue from a custom property; the others keep the template's shade. */
const HUE_SUPPORT = "(color: oklch(from red l c h))";

const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;
/** Tokens that are the look's own grounds and words, never an accent. */
const NEUTRAL_TOKEN = /^--(xs-(ink|ink-soft|ink-day|ink-solid|muted|ground|line|footer-ink|ph-ink|ph-ground|noise)|color-(ink|ink-soft|paper|paper-raised|line|line-strong|success|success-soft))$/;
/** Already pointed at the store's colour by app/xs-shell.css. */
const ACCENT_NAME = new Set([...ACCENT_TOKENS, "grad"].map((name) => `--xs-${name}`));
/** Colours that say something of their own. */
const MEANS_SOMETHING = /error|danger|invalid|warning|success|star|rating|whats|facebook|twitter|instagram|youtube|tiktok|telegram|pinterest|social/i;
const PAINTS = /^(color|fill|stroke|caret-color|accent-color|text-decoration(-color)?|text-shadow|box-shadow|outline(-color)?|column-rule(-color)?|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?)$/;
const WORDS = /^(color|fill|stroke|caret-color|text-decoration(-color)?|-webkit-text-fill-color)$/;
const ACCENT_VAR = /var\(--xs-(brand|accent|button|badge|highlight|grad)\b/;

/** A look's main buttons; an outlined one stays outlined. */
const BUTTON = /\.xs-btn\b|__button\b|__more-btn\b|__view\b/;
const NOT_MAIN_BUTTON = /outline|ghost|__button-icon/;
const BUTTON_FILL = "var(--xs-button)";
const BUTTON_HOVER = "color-mix(in oklab, var(--xs-button) 85%, #000)";

/** Below this a colour reads as grey: it has no hue worth carrying. */
const MIN_CHROMA = 0.015;

const round = (value, digits) => Number(value.toFixed(digits));

/** sRGB (0–255) to OKLCH lightness and chroma. */
export function oklchOf([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B) };
}

const sameRgb = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * The look's accent colours: the values of its accent tokens. `names` lists
 * every token holding one of them, the look's own aliases (--uo-pink) included.
 */
export function accentsOf(tokens) {
  const accents = [...ACCENT_NAME].map((name) => parseColor(tokens[name] ?? "")).filter(Boolean);
  accents.names = Object.entries(tokens)
    .filter(([, value]) => {
      const colour = parseColor(value);
      return colour && colour[3] === 1 && accents.some((accent) => sameRgb(accent, colour));
    })
    .map(([name]) => name);
  return accents;
}

/** One plain colour as the store's, following `base`; null when it has no hue to carry. */
export function ownColour(match, accents, base = "var(--xs-brand)") {
  const colour = parseColor(match);
  if (!colour) return null;
  const alpha = colour[3];
  if (accents.some((accent) => sameRgb(accent, colour))) {
    return alpha < 1 ? `color-mix(in srgb, ${base} ${round(alpha * 100, 1)}%, transparent)` : base;
  }
  const { l, c } = oklchOf(colour);
  if (c < MIN_CHROMA) return null;
  return `oklch(from ${base} ${round(l, 3)} ${round(c, 3)} h${alpha < 1 ? ` / ${round(alpha, 3)}` : ""})`;
}

/** Whether a colour in this declaration is the store's business at all. */
function paints(decl) {
  if (decl.value.includes("url(")) return false;
  if (decl.prop.startsWith("--")) return !NEUTRAL_TOKEN.test(decl.prop) && !ACCENT_NAME.has(decl.prop);
  return PAINTS.test(decl.prop);
}

function isAccentGround(decls, accents) {
  return decls.some(
    (d) =>
      /^background(-color)?$/.test(d.prop) &&
      (ACCENT_VAR.test(d.value) ||
        (accents.names ?? []).some((name) => d.value.includes(`var(${name})`)) ||
        (d.value.match(COLOUR) ?? []).some((match) => {
          const colour = parseColor(match);
          return colour && colour[3] >= 0.9 && accents.some((accent) => sameRgb(accent, colour));
        }))
  );
}

/** A value painted in the look's ink or dark: a variable, or a near-black written out. */
function inkOf(value) {
  if (/var\(--xs-(ink|dark)\b/.test(value)) return true;
  return (value.match(COLOUR) ?? []).some((match) => {
    const colour = parseColor(match);
    return colour && colour[3] >= 0.9 && luminance(colour) < 0.12;
  });
}

/** `value` with the look's ink or near-black swapped for `fill`. */
const inkTo = (value, fill) =>
  value
    .replace(COLOUR, (match) => {
      const colour = parseColor(match);
      return colour && colour[3] >= 0.9 && luminance(colour) < 0.12 ? fill : match;
    })
    .replace(/var\(--xs-(ink|dark)\b[^)]*\)/g, fill);

/** What a selector paints, without its states: `[data-xs-look="24"] .a:hover` is `.a`. */
const paintedPart = (selector) => selector.trim().split(/[\s>+~]+/).pop().replace(/::?[a-z-]+(\([^)]*\))?/g, "");

const isButton = (selector) => BUTTON.test(selector) && (!NOT_MAIN_BUTTON.test(selector) || selector.includes('data-tone="solid"'));

/**
 * The parts drawn on the accent, across a stylesheet: a look often colours a
 * button's words in a rule of its own, away from the rule that fills it.
 */
export function accentPartsOf(css, accents) {
  const parts = new Set();
  postcss.parse(css).walkRules((rule) => {
    const decls = rule.nodes.filter((node) => node.type === "decl");
    for (const selector of rule.selectors) {
      const filled = isButton(selector) && decls.some((d) => /^background(-color)?$/.test(d.prop) && inkOf(d.value));
      if (filled || isAccentGround(decls, accents)) parts.add(paintedPart(selector));
    }
  });
  return parts;
}

/**
 * The declarations one rule needs for a store's own colour; [] when it needs
 * none. `hued` names the look's own colour tokens (--uo-navy): in the dark a
 * word drawn in one takes the store's readable colour too. `button` marks a
 * look's main button, `hover` that button under the pointer, and `onPart` a
 * part filled with the accent by another rule.
 */
export function ownDeclarations(decls, accents, { dark = false, hued = new Set(), button = false, hover = false, onPart = false } = {}) {
  const out = [];
  const filled = button && decls.some((d) => /^background(-color)?$/.test(d.prop) && inkOf(d.value));
  const ownGround = decls.some((d) => /^background(-color)?$/.test(d.prop));
  const onAccent = filled || isAccentGround(decls, accents) || (onPart && !ownGround);
  const wordBase = "var(--xs-brand-text, var(--xs-brand))";
  if (filled && !hover && !decls.some((d) => d.prop === "color")) out.push({ prop: "color", value: "var(--color-on-primary)", important: false });
  for (const decl of decls) {
    if (filled && /^(background(-color)?|border(-color)?)$/.test(decl.prop) && inkOf(decl.value)) {
      out.push({ prop: decl.prop, value: inkTo(decl.value, hover ? BUTTON_HOVER : BUTTON_FILL), important: decl.important });
      continue;
    }
    if (decl.prop === "color" && onAccent) {
      out.push({ prop: "color", value: "var(--color-on-primary)", important: decl.important });
      continue;
    }
    if (!paints(decl)) continue;
    let value;
    if (dark && WORDS.test(decl.prop)) {
      value = decl.value
        .replace(COLOUR, (match) => (ownColour(match, accents) ? wordBase : match))
        .replace(/var\((--[a-z0-9-]+)\)/g, (whole, name) => (hued.has(name) ? wordBase : whole));
    } else {
      value = decl.value.replace(COLOUR, (match) => ownColour(match, accents) ?? match);
    }
    if (value !== decl.value) out.push({ prop: decl.prop, value, important: decl.important });
  }
  return out;
}

function scoped(scope, selector) {
  const s = selector.trim();
  if (/^(html|body|:root)\b/.test(s)) return null;
  // The store wrapper is named in it: the condition goes on the wrapper itself.
  if (s.includes(".brand-theme")) return s.replace(".brand-theme", `.brand-theme:where(${scope.slice(".brand-theme".length)})`);
  return `:where(${scope}) ${s}`;
}

const needsHue = (decl) => decl.value.includes("oklch(from");

/** `rule` inside the at-rules it was written in. */
function wrapped(rule, source) {
  let target = rule;
  for (let parent = source.parent; parent && parent.type === "atrule"; parent = parent.parent) {
    const wrap = postcss.atRule({ name: parent.name, params: parent.params });
    wrap.append(target);
    target = wrap;
  }
  return target;
}

/** Every rule of a stylesheet that needs a copy under `scope`, as CSS. */
export function ownRulesOf(css, accents, { scope = OWN_LIGHT, dark = false, hued = new Set(), parts = accentPartsOf(css, accents), from = "xs.css" } = {}) {
  const root = postcss.parse(css, { from });
  const plain = postcss.root();
  const hue = postcss.atRule({ name: "supports", params: HUE_SUPPORT });
  let tokenBlock = true;
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const decls = rule.nodes.filter((node) => node.type === "decl");
    // The look's token block is written by ownTokenRule.
    if (tokenBlock && decls.some((d) => d.prop.startsWith("--xs-"))) {
      tokenBlock = false;
      return;
    }
    const wanted = rule.selectors.filter((s) => !MEANS_SOMETHING.test(s));
    // A rule naming a button beside something else is read once for each.
    for (const group of [wanted.filter(isButton), wanted.filter((s) => !isButton(s))]) {
      const selectors = group.map((s) => scoped(scope, s)).filter(Boolean);
      if (selectors.length === 0) continue;
      const button = isButton(group[0]);
      const onPart = group.every((s) => parts.has(paintedPart(s)));
      const own = ownDeclarations(decls, accents, { dark, hued, button, onPart, hover: button && group.every((s) => /:(hover|focus|active)/.test(s)) });
      for (const [list, target] of [
        [own.filter((d) => !needsHue(d)), plain],
        [own.filter(needsHue), hue],
      ]) {
        if (list.length === 0) continue;
        const copy = postcss.rule({ selectors });
        for (const decl of list) copy.append(postcss.decl(decl));
        target.append(wrapped(copy, rule));
      }
    }
  });
  if (hue.nodes?.length) plain.append(hue);
  return plain.toString();
}

/** Every custom property of a look's token block, its own palette (--uo-*) included. */
export function colourTokensOf(css) {
  const root = postcss.parse(css);
  let tokens = {};
  root.walkRules((rule) => {
    if (Object.keys(tokens).length > 0) return;
    const own = {};
    rule.walkDecls(/^--/, (decl) => {
      own[decl.prop] = decl.value;
    });
    if (Object.keys(own).some((name) => name.startsWith("--xs-"))) tokens = own;
  });
  return tokens;
}

/** The look's palette tokens that carry a hue. */
function huedTokens(tokens) {
  const accents = accentsOf(tokens);
  return Object.entries(tokens)
    .filter(([name, value]) => !NEUTRAL_TOKEN.test(name) && !ACCENT_NAME.has(name) && parseColor(value))
    .map(([name, value]) => [name, ownColour(value, accents)])
    .filter(([, value]) => value);
}

/** The look's own colour tokens as the store's, on the wrapper and on every part drawn in the look. */
export function ownTokenRule(look, tokens) {
  const hued = huedTokens(tokens);
  if (hued.length === 0) return "";
  const at = [OWN_LIGHT, OWN_DARK].flatMap((scope) => [`${scope}[data-xs-shell="${look}"]`, `${scope} [data-xs-look="${look}"]`]).join(",\n");
  const body = (list) => list.map(([name, value]) => `  ${name}: ${value};`).join("\n");
  const plain = hued.filter(([, value]) => !value.includes("oklch(from"));
  const shaded = hued.filter(([, value]) => value.includes("oklch(from"));
  return [
    plain.length ? `${at} {\n${body(plain)}\n}\n` : "",
    shaded.length ? `@supports ${HUE_SUPPORT} {\n${at} {\n${body(shaded)}\n}\n}\n` : "",
  ].join("");
}

/** What a look's own file adds for a store with its own colour: its tokens and the rules they can't reach. */
export function xsAccentCss(look, source, baseTokens, shared = "") {
  const tokens = { ...baseTokens, ...colourTokensOf(source) };
  const accents = accentsOf(tokens);
  const parts = accentPartsOf(`${shared}\n${source}`, accents);
  return [ownTokenRule(look, tokens), ownRulesOf(shared, accents, { parts, from: "xs-shared.css" }), ownRulesOf(source, accents, { parts, from: `xs-look-${look}.css` })]
    .filter(Boolean)
    .join("\n");
}

/** The same for the one dark stylesheet: the shared bands once, then each look that has a dark mode. */
export function xsAccentDarkCss({ shared, looks, baseTokens }) {
  const light = Object.keys(looks).filter((look) => !NATIVE_DARK_LOOKS.includes(look)).sort();
  const parts = [ownRulesOf(shared, accentsOf(baseTokens), { scope: OWN_DARK, dark: true, from: "xs-shared.css" })];
  for (const look of light) {
    if (!looks[look]) continue;
    const tokens = { ...baseTokens, ...colourTokensOf(looks[look]) };
    const hued = new Set(huedTokens(tokens).map(([name]) => name));
    const accents = accentsOf(tokens);
    parts.push(ownRulesOf(looks[look], accents, { scope: OWN_DARK, dark: true, hued, parts: accentPartsOf(`${shared}\n${looks[look]}`, accents), from: `xs-look-${look}.css` }));
  }
  return parts.filter(Boolean).join("\n");
}
