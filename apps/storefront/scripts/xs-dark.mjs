/**
 * The dark look of the imported templates ("xs" looks), worked out from their
 * light stylesheets when the looks are built (scripts/xs-look-css.mjs), so no
 * look has a dark file written by hand.
 *
 * It is one stylesheet, public/xs/dark.<hash>.css, linked only by a store that
 * can be dark (its shoppers' default is dark, or it shows the light/dark
 * button) and inert until the store wrapper says `data-color-mode="dark"`
 * (lib/storeColorMode.ts, set by the server from the shopper's cookie or the
 * merchant's default, so the first paint is already right). It holds:
 *
 *   1. each look's dark tokens (src/lib/xsDarkPalette.mjs darkTokensOf): the
 *      grounds and words flip, the look's accents and dark bands stay, and an
 *      accent used for words is lightened just enough to read;
 *   2. a dark copy of every rule that paints with a colour the tokens can't
 *      reach — a literal white ground, a literal dark grey word, a light
 *      border, a white veil or a fade to white — with that colour swapped for
 *      the dark one. A rule is read whole: words on a coloured ground (a
 *      yellow button) keep the look's light-mode ink; a ground in the
 *      template's ink under white words stays dark. Nothing else is copied.
 *
 * The looks that are dark already (NATIVE_DARK_LOOKS) are left as they are.
 */
import postcss from "postcss";
import { colourTokensOf, xsAccentDarkCss } from "./xs-accent.mjs";
import {
  ACCENT_TOKENS,
  DARK,
  NATIVE_DARK_LOOKS,
  contrast,
  darkTokensOf,
  lightenToRead,
  luminance,
  parseColor,
  saturation,
  toHex,
} from "../src/lib/xsDarkPalette.mjs";

/** On the store wrapper: the attribute every dark rule hangs from. */
export const DARK_ATTR = '[data-color-mode="dark"]';

const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/gi;
const GROUND_LIKE = /var\(--(xs-(brand|button|accent|badge|highlight|grad|deep|dots-[\w-]+|own-[\w-]+)|color-primary)\b/;

/** The look's token block: the `--xs-*` values of the file's first rule. */
export function tokensOf(css) {
  const root = postcss.parse(css);
  let tokens = {};
  root.walkRules((rule) => {
    if (Object.keys(tokens).length > 0) return;
    const own = {};
    rule.walkDecls(/^--xs-/, (decl) => {
      own[decl.prop] = decl.value;
    });
    if (Object.keys(own).length > 0) tokens = own;
  });
  return tokens;
}

/**
 * The dark copy of one selector, hung from the dark store wrapper at exactly
 * the original's specificity (the wrapper's attribute in :where), so the
 * copies keep the light rules' order among themselves: a look's rule still
 * beats a shared band's, and a copy beats its original by coming later (the
 * dark file is linked after the looks').
 */
export function darkSelector(selector) {
  const s = selector.trim();
  if (/^(html|body|:root)\b/.test(s)) return null;
  // The store wrapper is named in it: the attribute goes on the wrapper itself.
  if (s.includes(".brand-theme")) return s.replace(".brand-theme", `.brand-theme:where(${DARK_ATTR})`);
  return `:where(.brand-theme${DARK_ATTR}) ${s}`;
}

/**
 * A declaration's value with its literal colours and its `var()`s each passed
 * through a function: `colour(match)` for a colour written outside any var()
 * (a var's fallback is the token's business), `variable(name, fallback)` for
 * each var — the fallback already transformed — returning its replacement, or
 * null to keep it as it was.
 */
export function mapValue(value, { colour = (c) => c, variable = () => null } = {}) {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("var(", i);
    const plain = value.slice(i, at === -1 ? value.length : at);
    out += plain.replace(COLOUR, (match) => colour(match));
    if (at === -1) break;
    // The var's own parentheses, nested ones included.
    let depth = 0;
    let end = at + 3;
    for (; end < value.length; end += 1) {
      if (value[end] === "(") depth += 1;
      else if (value[end] === ")" && --depth === 0) break;
    }
    const inner = value.slice(at + 4, end);
    const comma = inner.indexOf(",");
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? null : mapValue(inner.slice(comma + 1).trim(), { variable });
    const original = fallback === null ? `var(${name})` : `var(${name}, ${fallback})`;
    out += variable(name, fallback) ?? original;
    i = end + 1;
  }
  return out;
}

/** `var(--next, var(--name[, fallback]))`: the dark token first, the light one as it was after it. */
const before = (next, name, fallback) => `var(${next}, var(${name}${fallback === null ? "" : `, ${fallback}`}))`;

const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
const GROUND_RGB = parseColor(DARK.ground);

/** What a rule paints its ground with. */
function groundOf(decls) {
  const values = decls.filter((d) => /^background(-color|-image)?$/.test(d.prop)).map((d) => d.value);
  if (values.length === 0) return "none";
  const value = values.join(" ");
  if (GROUND_LIKE.test(value)) return "accent";
  if (/var\(--xs-(ink|dark)\b/.test(value) && !/var\(--xs-(ground|tint)\b/.test(value)) return /var\(--xs-ink\b/.test(value) ? "ink" : "dark";
  if (/var\(--xs-(ground|tint)\b/.test(value)) return "light";
  const colours = (value.match(COLOUR) ?? []).map(parseColor).filter((c) => c && c[3] >= 0.5);
  if (colours.length === 0) return /url\(/.test(value) ? "image" : "none";
  const first = colours[0];
  const lum = luminance(first);
  if (lum > 0.6) return "light";
  if (saturation(first) > 0.25) return "accent";
  return lum < 0.2 ? "dark" : "accent";
}

/** A ground's colour in the dark: white is the dark ground, a light grey the tint, a white veil a dark veil. */
function darkGroundColour(match) {
  const c = parseColor(match);
  if (!c || luminance(c) <= 0.6) return match;
  if (c[3] < 0.98) return rgba(GROUND_RGB, c[3]);
  return luminance(c) >= 0.97 ? "var(--xs-ground)" : "var(--xs-tint)";
}

/** Words in a literal colour, on the dark ground; light words (on a picture, a button, a dark band) stay. */
function darkWordColour(match) {
  const c = parseColor(match);
  if (!c) return match;
  const lum = luminance(c);
  if (lum > 0.6) return match;
  if (c[3] < 1) return rgba(parseColor(DARK.ink), c[3]);
  if (saturation(c) > 0.25) return lightenToRead(c) ?? match;
  return lum < 0.1 ? "var(--xs-ink)" : "var(--xs-ink-soft)";
}

/** A border's colour in the dark: a light line is the dark line, a faint dark hairline a faint light one. */
function darkLineColour(match) {
  const c = parseColor(match);
  if (!c) return match;
  if (luminance(c) > 0.6 && c[3] >= 0.5) return "var(--xs-line)";
  if (luminance(c) < 0.1 && c[3] < 0.5) return rgba([255, 255, 255], c[3]);
  return match;
}

const WORD_PROPS = /^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color)$/;
const LINE_PROPS = /^(border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|column-rule(-color)?)$/;
const ACCENT_NAMES = new Set(ACCENT_TOKENS.map((name) => `--xs-${name}`));

/**
 * The declarations of one rule as they are in the dark, or [] when the tokens
 * already cover it. `tokens` is the look's own palette: a word drawn in one of
 * its colours (--uo-navy) is read like a word written in that colour.
 */
export function darkDeclarations(decls, tokens = {}) {
  const ground = groundOf(decls);
  const words = decls.filter((d) => d.prop === "color").map((d) => d.value).join(" ");
  // A ground in the template's ink with words in its ground: a pair that flips by itself.
  const inverse = ground === "ink" && /var\(--xs-(ground|tint)\b/.test(words);
  const out = [];
  for (const decl of decls) {
    if (decl.prop.startsWith("--")) continue;
    let value = decl.value;
    if (/^background(-color|-image)?$/.test(decl.prop)) {
      value = mapValue(value, {
        colour: darkGroundColour,
        // A ground in the template's ink under white words stays dark (the ink itself turns light).
        variable: (name, fallback) => (name === "--xs-ink" && ground === "ink" && !inverse ? before("--xs-ink-solid", name, fallback) : null),
      });
    } else if (WORD_PROPS.test(decl.prop)) {
      if (ground === "accent") {
        // Words on a coloured ground keep the light-mode ink they were drawn in.
        value = mapValue(value, {
          variable: (name, fallback) => (/^--xs-(ink|ink-soft|dark)$/.test(name) ? before("--xs-ink-day", name, fallback) : null),
        });
      } else if (ground !== "dark" && ground !== "image" && !inverse) {
        value = mapValue(value, {
          colour: darkWordColour,
          variable: (name, fallback) =>
            name === "--xs-dark"
              ? `var(--xs-ink${fallback === null ? "" : `, ${fallback}`})`
              : ACCENT_NAMES.has(name)
                ? before(`${name}-text`, name, fallback)
                : !/^--(xs|color)-/.test(name) && parseColor(tokens[name] ?? "")
                  ? darkWordColour(tokens[name])
                  : null,
        });
      }
    } else if (LINE_PROPS.test(decl.prop)) {
      value = mapValue(value, { colour: darkLineColour });
    }
    if (value !== decl.value) out.push({ prop: decl.prop, value, important: decl.important });
  }
  return out;
}

/** Every rule of a stylesheet that needs a dark copy, as dark CSS. */
export function darkRulesOf(css, from = "xs.css", tokens = {}) {
  const root = postcss.parse(css, { from });
  const out = postcss.root();
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const decls = rule.nodes.filter((node) => node.type === "decl");
    const dark = darkDeclarations(decls, tokens);
    if (dark.length === 0) return;
    const selectors = rule.selectors.map(darkSelector).filter(Boolean);
    if (selectors.length === 0) return;
    const copy = postcss.rule({ selectors });
    for (const decl of dark) copy.append(postcss.decl(decl));
    // Kept inside the same @media (or other at-rule) as the original.
    let target = copy;
    for (let parent = rule.parent; parent && parent.type === "atrule"; parent = parent.parent) {
      const wrap = postcss.atRule({ name: parent.name, params: parent.params });
      wrap.append(target);
      target = wrap;
    }
    out.append(target);
  });
  return out.toString();
}

/**
 * One look's dark tokens, on the dark store wrapper and on every part drawn in
 * the look — more specific than the look's own token block and than the
 * store's Template look (its "easier to read" shades are light-mode shades).
 */
export function darkTokenRule(look, tokens) {
  const values = darkTokensOf(tokens);
  const body = Object.entries(values)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `.brand-theme${DARK_ATTR}[data-xs-shell="${look}"],\n.brand-theme${DARK_ATTR} [data-xs-look="${look}"] {\n  color-scheme: dark;\n${body}\n}\n`;
}

/** What every dark store shares: its own pages' soft tints and status colours, and a store's own accent as words. */
export const DARK_SHARED = `.brand-theme${DARK_ATTR}[data-xs-shell] {
  color-scheme: dark;
  --color-primary-soft: color-mix(in oklab, var(--brand-primary) 22%, ${DARK.ground});
  --color-accent-soft: color-mix(in oklab, var(--brand-secondary) 20%, ${DARK.ground});
  --color-danger: #e8846a;
  --color-danger-soft: #2b1613;
  --color-success: #5cbf8f;
  --color-success-soft: #132b1f;
}
.brand-theme${DARK_ATTR}[data-xs-own-accent-dark],
.brand-theme${DARK_ATTR}[data-xs-own-accent-dark] [data-xs-look] {
${ACCENT_TOKENS.map((name) => `  --xs-${name}-text: var(--xs-own-accent-text, color-mix(in srgb, var(--color-primary) 45%, #fff));`).join("\n")}
}
`;

/**
 * The whole dark stylesheet, unminified: each light look's tokens, the
 * shared part, then the dark copies of the shared bands' rules and of each
 * light look's own.
 *
 * `shared` is the shared base's files' CSS in cascade order; `looks` maps each
 * look to its own file's CSS ("" for look 01, whose tokens are in the shared base).
 */
export function xsDarkCss({ shared, looks, baseTokens }) {
  const light = Object.keys(looks)
    .filter((look) => !NATIVE_DARK_LOOKS.includes(look))
    .sort();
  const parts = [];
  for (const look of light) parts.push(darkTokenRule(look, look === "01" ? baseTokens : { ...baseTokens, ...tokensOf(looks[look]) }));
  // After the looks' tokens: a store's own accent wins over the look's.
  parts.push(DARK_SHARED);
  parts.push(darkRulesOf(shared, "xs-shared.css"));
  for (const look of light) if (looks[look]) parts.push(darkRulesOf(looks[look], `xs-look-${look}.css`, colourTokensOf(looks[look])));
  // Last: a store's own colour over the dark copies above (scripts/xs-accent.mjs).
  parts.push(xsAccentDarkCss({ shared, looks, baseTokens }));
  return parts.join("\n");
}

export { contrast, luminance, toHex };
