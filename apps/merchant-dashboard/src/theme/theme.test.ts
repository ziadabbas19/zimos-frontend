import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GLOW_PRESETS, ORIGINAL_GLOW_LEFT, ORIGINAL_GLOW_RIGHT } from "@/lib/glowPresets";

const SRC = fileURLToPath(new URL("..", import.meta.url));
/**
 * The layers the platform console draws with too (tokens, looks, the glass
 * shell, the base of index.css) and the store of the look are in packages/ui;
 * `ui/…` names a file there. This dashboard's own screens stay under theme/.
 */
const UI = join(SRC, "..", "..", "..", "packages", "ui", "src");
const read = (relative: string) => readFileSync(relative.startsWith("ui/") ? join(UI, relative.slice(3)) : join(SRC, relative), "utf8");

function cssFiles(dir: string): string[] {
  const at = dir.startsWith("ui/") ? join(UI, dir.slice(3)) : join(SRC, dir);
  return readdirSync(at, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? cssFiles(`${dir}/${entry.name}`) : entry.name.endsWith(".css") ? [`${dir}/${entry.name}`] : []
  );
}

describe("the dashboard's theme", () => {
  const tokens = read("ui/theme/tokens.css");

  it("has one brand, and every primary shade comes from it", () => {
    expect(tokens.match(/--brand: #[0-9a-f]{6};/g)).toEqual(["--brand: #165dff;"]);
    expect(tokens).toContain("--color-primary: var(--brand);");
    expect(tokens).not.toContain("data-product");
  });

  it("sets the light and the dark neutrals, and the dark card shadow where index.css set its own", () => {
    expect(tokens).toMatch(/:root \{[^}]*--color-paper: #f5f6f8;/);
    expect(tokens).toMatch(/\.dark \{[^}]*--color-paper: #0e1014;/);
    expect(tokens).toMatch(/html\.dark \{\s*--shadow-card: /);
  });

  it("is loaded after index.css, tokens first", () => {
    const main = read("main.tsx");
    const order = [
      "./index.css",
      "@store-builder/ui/theme/tokens.css",
      "@store-builder/ui/theme/looks.css",
      "@store-builder/ui/theme/liquid-glass.css",
      "@store-builder/ui/theme/glass/menu.css",
    ].map((file) => main.indexOf(`'${file}'`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("brings no image, font file or stylesheet of its own: colours and shapes only", () => {
    // app.css is the base of index.css (Tailwind's own map), not a layer of the theme.
    const files = [...cssFiles("theme"), ...cssFiles("ui/theme").filter((file) => file !== "ui/theme/app.css")];
    expect(files.length).toBeGreaterThanOrEqual(13);
    for (const file of files) {
      const text = read(file);
      // url(#id) names a filter drawn in the page (the phone dock's lens), not a file.
      expect(text, file).not.toMatch(/url\((?!#)/);
      expect(text, file).not.toMatch(/@import/);
      expect(text, file).not.toMatch(/@font-face/);
    }
  });

  it("keeps our logo in the side menu, on the frame the theme styles", () => {
    const layout = read("components/DashboardLayout.tsx");
    const menu = read("components/shell/SidebarNav.tsx");
    expect(menu).toContain('import { ZimosLogo } from "@/components/ZimosLogo";');
    expect(menu).toContain("<ZimosLogo height={22} />");
    expect(layout).toContain('data-slot="side-menu"');
    expect(layout).toContain('data-slot="toolbar"');
  });

  it("draws the shell with icons from the one icon file, all of them lucide", () => {
    const icons = read("components/icons.ts");
    expect(icons).toMatch(/\} from "lucide-react";/);
    expect(icons).not.toMatch(/phosphor/i);
    for (const file of ["components/shell/SidebarNav.tsx", "components/shell/PhoneMenu.tsx", "components/shell/AccountMenu.tsx", "components/shell/StoreSwitcher.tsx", "components/MobileTabBar.tsx"]) {
      expect(read(file), file).not.toMatch(/phosphor|weight=/i);
    }
  });

  it("can be switched off: the glass layer is written against data-glass, and the page sets it before first paint", () => {
    for (const file of [...cssFiles("theme/glass"), ...cssFiles("ui/theme/glass")]) expect(read(file), file).toContain(':root:not([data-glass="off"])');
    expect(read("ui/theme/liquid-glass.css")).toContain(':root:not([data-glass="off"])');
    const page = readFileSync(join(SRC, "..", "index.html"), "utf8");
    expect(page).toContain('get("zimos.glass")');
    expect(page).toContain('e.setAttribute("data-glass", "off")');
    // No installable-app or worker wiring came with the shell.
    expect(page).not.toMatch(/manifest|serviceWorker/);
    expect(read("main.tsx")).not.toMatch(/serviceWorker|InstallAppPrompt|errorReporting/);
  });
});

/* ------------------------------------------------------------------ *
 * Colour arithmetic for the checks below: what the browser does with
 * `color-mix(in srgb, …)` and with one translucent fill over another,
 * and the WCAG contrast of the result.
 * ------------------------------------------------------------------ */
type Rgb = [number, number, number];
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const toHex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
/** color-mix(in srgb, a share, b), and a at alpha `share` over b: the same sum. */
const mix = (a: Rgb, share: number, b: Rgb): Rgb => [0, 1, 2].map((i) => a[i] * share + b[i] * (1 - share)) as Rgb;

function luminance(c: Rgb): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The declarations of the first rule that opens with exactly `selector {`. */
function rule(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
}
/** A token that is a plain hex colour. */
function colour(declarations: string, name: string): Rgb {
  const found = new RegExp(`${name}: (#[0-9a-f]{6});`).exec(declarations);
  expect(found, name).not.toBeNull();
  return rgb(found![1]);
}
/** The share in `name: color-mix(in srgb, <what> NN%, <rest>)`. */
function share(declarations: string, name: string): number {
  const found = new RegExp(`${name}: color-mix\\(in srgb, [^,]+ (\\d+)%, `).exec(declarations);
  expect(found, name).not.toBeNull();
  return Number(found![1]) / 100;
}

const NEUTRALS = ["--color-paper", "--color-paper-raised", "--color-paper-sunken", "--color-line", "--color-line-strong"] as const;
type Neutral = (typeof NEUTRALS)[number];

describe("the three looks", () => {
  const tokens = read("ui/theme/tokens.css");
  const looks = read("ui/theme/looks.css");
  const glass = read("ui/theme/liquid-glass.css");
  const darkTokens = rule(tokens, "\n.dark");
  const blackTokens = rule(looks, ':root[data-look="black"]');
  const toneTokens = rule(looks, ':root[data-look="dark"][data-tone]');

  /** The three colours a neutral runs through: [the dark look as it always was, midnight, slate]. */
  function stops(name: string): [Rgb, Rgb, Rgb] {
    const found = new RegExp(
      `${name}: color-mix\\(in srgb, color-mix\\(in srgb, (#[0-9a-f]{6}) var\\(--tone-mid\\), (#[0-9a-f]{6})\\), (#[0-9a-f]{6}) var\\(--tone-slate\\)\\);`
    ).exec(toneTokens);
    expect(found, name).not.toBeNull();
    return [rgb(found![1]), rgb(found![2]), rgb(found![3])];
  }
  /** A neutral at a tone, with the two shares lib/appearance.ts and index.html write for it. */
  function atTone(name: string, tone: number): Rgb {
    const [middle, midnight, slate] = stops(name);
    const mid = Math.min(100, tone * 2) / 100;
    const toSlate = Math.max(0, (tone - 50) * 2) / 100;
    return mix(slate, toSlate, mix(middle, mid, midnight));
  }

  // The brand, its shades and the status colours are the same in Black and in Dark at every tone.
  const brand = colour(tokens, "--brand");
  const accents = {
    primary: mix(brand, share(darkTokens, "--color-primary"), WHITE),
    success: colour(darkTokens, "--color-success"),
    danger: colour(darkTokens, "--color-danger"),
    warning: colour(darkTokens, "--color-accent-dark"),
  };
  const darkInk = { ink: colour(darkTokens, "--color-ink"), soft: colour(darkTokens, "--color-ink-soft") };
  const blackInk = { ink: colour(blackTokens, "--color-ink"), soft: colour(blackTokens, "--color-ink-soft") };

  const neutralsOf = (pick: (name: Neutral) => Rgb) => Object.fromEntries(NEUTRALS.map((name) => [name, pick(name)])) as Record<Neutral, Rgb>;
  const LOOKS = [
    { name: "Black", ...blackInk, neutrals: neutralsOf((name) => colour(blackTokens, name)) },
    { name: "Dark at 0 (midnight)", ...darkInk, neutrals: neutralsOf((name) => atTone(name, 0)) },
    { name: "Dark at 25", ...darkInk, neutrals: neutralsOf((name) => atTone(name, 25)) },
    { name: "Dark at 50 (as it always was)", ...darkInk, neutrals: neutralsOf((name) => atTone(name, 50)) },
    { name: "Dark at 75", ...darkInk, neutrals: neutralsOf((name) => atTone(name, 75)) },
    { name: "Dark at 100 (slate)", ...darkInk, neutrals: neutralsOf((name) => atTone(name, 100)) },
  ];

  it("leaves Light, and Dark at its default tone, to tokens.css: every rule here is Black's or a chosen tone's", () => {
    const selectors = looks
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((chunk) => chunk.split("{")[0].trim())
      .filter(Boolean)
      .flatMap((list) => list.split(",").map((selector) => selector.trim()));
    expect(selectors.length).toBeGreaterThan(2);
    for (const selector of selectors) expect(selector).toMatch(/^:root\[data-look="black"\]|^:root\[data-look="dark"\]\[data-tone\]$/);
  });

  it("makes Black a pure black page with near-black surfaces, thin lines and no blue in its greys", () => {
    expect(blackTokens).toContain("--color-paper: #000000;");
    expect(blackTokens).toContain("--color-paper-raised: #0a0a0a;");
    expect(blackTokens).toContain("--color-paper-sunken: #141414;");
    expect(blackTokens).toContain("--color-line: #242424;");
    for (const name of [...NEUTRALS, "--color-ink", "--color-ink-soft"]) {
      const [r, g, b] = colour(blackTokens, name);
      expect(r === g && g === b, name).toBe(true);
    }
    // No shadow that could read as a glow.
    expect(blackTokens).toContain("--shadow-card: none;");
    expect(blackTokens).not.toMatch(/gradient|blur/);
  });

  it("puts the dark look as it always was in the middle of the tone, value for value", () => {
    for (const name of NEUTRALS) {
      expect(toHex(stops(name)[0]), name).toBe(toHex(colour(darkTokens, name)));
      expect(toHex(atTone(name, 50)), name).toBe(toHex(colour(darkTokens, name)));
    }
    // With glass on, the ground of the backdrop: the same three stops, and the one in the middle is the one the glass layer falls back to.
    expect(glass).toContain(`--lg-bg-base: var(--lg-tone-base, ${toHex(stops("--lg-tone-base")[0])});`);
    expect(toHex(stops("--lg-tone-base")[0])).toBe("#070a16");
  });

  it("runs from midnight blue to slate, one step at a time", () => {
    // hsl(220 40% 6%) and hsl(220 12% 12%).
    expect(toHex(atTone("--color-paper", 0))).toBe("#090d15");
    expect(toHex(atTone("--color-paper", 100))).toBe("#1b1d22");
    expect(toHex(atTone("--color-paper-raised", 0))).toBe("#101521");
    expect(toHex(atTone("--color-paper-raised", 100))).toBe("#24272d");
    // The page gets lighter and less blue all the way along: no jump, no turning back.
    const blueness = (c: Rgb) => c[2] - c[0];
    for (let tone = 1; tone <= 100; tone++) {
      const before = atTone("--color-paper", tone - 1);
      const here = atTone("--color-paper", tone);
      expect(luminance(here), `tone ${tone}`).toBeGreaterThan(luminance(before));
      expect(blueness(here) / here[2], `tone ${tone}`).toBeLessThan(blueness(before) / before[2]);
      expect(Math.max(...here.map((v, i) => Math.abs(v - before[i]))), `tone ${tone}`).toBeLessThan(1);
    }
    // At midnight the lines carry the blue; a card is always a step above the page.
    const line = atTone("--color-line", 0);
    expect(line[2] - line[0]).toBeGreaterThan(20);
    for (const { name, neutrals } of LOOKS) {
      expect(luminance(neutrals["--color-paper-raised"]), name).toBeGreaterThan(luminance(neutrals["--color-paper"]));
      expect(luminance(neutrals["--color-paper-sunken"]), name).toBeGreaterThan(luminance(neutrals["--color-paper-raised"]));
    }
  });

  it("keeps text and the accents at 4.5:1 or better on every surface, in Black and at both ends of the tone", () => {
    for (const { name, ink, soft, neutrals } of LOOKS) {
      for (const surface of ["--color-paper", "--color-paper-raised", "--color-paper-sunken"] as const) {
        const on = neutrals[surface];
        for (const [what, text] of Object.entries({ ink, soft, ...accents })) {
          expect(contrast(text, on), `${name}: ${what} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
        // The edge of a field, a switch, a checkbox (WCAG 1.4.11).
        expect(contrast(neutrals["--color-line-strong"], on), `${name}: control edge on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("is set before first paint, from the same keys the app keeps", () => {
    const page = readFileSync(join(SRC, "..", "index.html"), "utf8");
    const store = read("ui/appearance/store.ts");
    for (const key of ["zimos.look", "zimos.darkLook", "zimos.darkTone", "zimos.glass", "zimos.glowLeft", "zimos.glowRight", "zimos.glowIntensity", "theme"]) {
      expect(page, key).toContain(`get("${key}")`);
      expect(store, key).toContain(`"${key}"`);
    }
    expect(page).toContain('e.setAttribute("data-look", s)');
    for (const name of ["--zimos-tone-mid", "--zimos-tone-slate", "--zimos-glow-left", "--zimos-glow-right", "--zimos-glow-strength"]) {
      expect(page, name).toContain(`"${name}"`);
      expect(store, name).toContain(`"${name}"`);
    }
  });
});

describe("the glow colours of the glass backdrop", () => {
  const tokens = read("ui/theme/tokens.css");
  const looks = read("ui/theme/looks.css");
  const glass = read("ui/theme/liquid-glass.css");
  const POOLS = ["brand", "violet", "pink", "peach", "sky"] as const;

  // liquid-glass.css is one nested rule: the light values come first, the dark ones inside `&.dark {`.
  const darkAt = glass.indexOf("&.dark {");
  const lightGlass = glass.slice(0, darkAt);
  const darkGlass = glass.slice(darkAt, glass.indexOf(".glass-app {", darkAt));

  it("draws the pools in the colours they always had while nothing is chosen", () => {
    expect(lightGlass).toContain("--lg-own-brand: color-mix(in srgb, var(--brand) 40%, white);");
    expect(lightGlass).toContain("--lg-own-violet: #b9a5ff;");
    expect(lightGlass).toContain("--lg-own-pink: #ffa8d4;");
    expect(lightGlass).toContain("--lg-own-peach: #ffc594;");
    expect(lightGlass).toContain("--lg-own-sky: #8fdcff;");
    expect(lightGlass).toContain("--lg-bg-base: #d5defc;");
    expect(darkGlass).toContain("--lg-own-brand: color-mix(in srgb, var(--brand) 60%, black);");
    expect(darkGlass).toContain("--lg-own-violet: #43259a;");
    expect(darkGlass).toContain("--lg-own-pink: #7a1d5c;");
    expect(darkGlass).toContain("--lg-own-peach: #6b3414;");
    expect(darkGlass).toContain("--lg-own-sky: #0b5578;");

    for (const pool of POOLS) {
      // A pool is its dimmed colour, else its picked colour, else its own: the first two are
      // built from variables <html> only carries after a choice, so by default it is its own.
      expect(lightGlass, pool).toContain(`--lg-bg-${pool}: var(--lg-dim-${pool}, var(--lg-pick-${pool}, var(--lg-own-${pool})));`);
      expect(lightGlass, pool).toContain(`--lg-dim-${pool}: color-mix(in srgb, var(--lg-pick-${pool}, var(--lg-own-${pool})) var(--zimos-glow-strength), transparent);`);
      // The dark block changes what a pool's own and picked colours are, never the chain.
      expect(darkGlass, pool).not.toContain(`--lg-bg-${pool}:`);
      expect(darkGlass, pool).not.toContain(`--lg-dim-${pool}:`);
    }
    // No default hides in the variables themselves: unset means unset.
    expect(glass).not.toMatch(/var\(--zimos-glow-(left|right|strength),/);
    expect(looks + tokens + read("index.css") + read("ui/theme/app.css")).not.toMatch(/--zimos-glow-/);
  });

  it("paints the left pools from the left colour and the right pools from the right one", () => {
    for (const css of [lightGlass, darkGlass]) {
      expect(css).toMatch(/--lg-pick-brand: color-mix\(in srgb, var\(--zimos-glow-left\) \d+%, (white|black)\);/);
      expect(css).toMatch(/--lg-pick-peach: color-mix\(in srgb, var\(--zimos-glow-left\) \d+%, (white|black)\);/);
      expect(css).toMatch(/--lg-pick-violet: color-mix\(in srgb, var\(--zimos-glow-right\) \d+%, (white|black)\);/);
      expect(css).toMatch(/--lg-pick-pink: color-mix\(in srgb, var\(--zimos-glow-right\) \d+%, (white|black)\);/);
    }
    // The middle pool: both colours blended, or the one that was chosen.
    expect(lightGlass).toContain("--lg-pick-both: color-mix(in srgb, var(--lg-pick-brand) 50%, var(--lg-pick-violet));");
    expect(lightGlass).toContain("--lg-pick-sky: var(--lg-pick-both, var(--lg-pick-brand, var(--lg-pick-violet)));");
  });

  it("is what both backdrops draw: the dashboard's and the sign-in screens'", () => {
    for (const file of ["ui/theme/liquid-glass.css", "ui/theme/glass/sweep-account.css"]) {
      const css = read(file);
      for (const pool of POOLS) expect(css, `${file} ${pool}`).toMatch(new RegExp(`radial-gradient\\([^)]*, var\\(--lg-bg-${pool}\\) 0%, transparent`));
      expect(css, file).toMatch(/radial-gradient\([^;]*var\(--lg-bg-base\);/);
    }
  });

  it("keeps text at 4.5:1 over the brightest palette, and over any colour that can be picked", () => {
    const picks = [ORIGINAL_GLOW_LEFT, ORIGINAL_GLOW_RIGHT, ...GLOW_PRESETS.flatMap((preset) => [preset.left, preset.right])].filter(
      (value): value is string => value !== null
    );
    for (const pick of picks) expect(pick).toMatch(/^#[0-9a-f]{6}$/);

    const lightTokens = tokens.slice(0, tokens.indexOf("\n.dark {"));
    const darkTokens = rule(tokens, "\n.dark");
    const brand = colour(tokens, "--brand");
    // Text on a pane takes a deeper shade (liquid-glass.css): the recipes are held here word for word.
    expect(lightGlass).toContain("--lg-ink-soft: color-mix(in srgb, var(--color-ink-soft) 86%, var(--color-ink));");
    expect(lightGlass).toContain("--lg-text-primary: color-mix(in srgb, var(--color-primary) 86%, black);");
    expect(lightGlass).toContain("--lg-text-success: color-mix(in srgb, var(--color-success) 86%, black);");
    expect(lightGlass).toContain("--lg-text-danger: color-mix(in srgb, var(--color-danger) 88%, black);");
    expect(darkGlass).toContain("--lg-text-primary: color-mix(in srgb, var(--color-primary) 86%, white);");
    expect(darkGlass).toContain("--lg-text-success: color-mix(in srgb, var(--color-success) 90%, white);");
    expect(darkGlass).toContain("--lg-text-danger: color-mix(in srgb, var(--color-danger) 86%, white);");

    function texts(ink: Rgb, soft: Rgb, primary: Rgb, success: Rgb, danger: Rgb, shares: [number, number, number], toward: Rgb) {
      return {
        ink,
        "soft ink": mix(soft, 0.86, ink),
        primary: mix(primary, shares[0], toward),
        success: mix(success, shares[1], toward),
        danger: mix(danger, shares[2], toward),
      };
    }
    /** The lowest contrast of any text on the two panes that lie straight on a pool: the page pane and the side menu. */
    function worst(words: Record<string, Rgb>, raised: Rgb, fills: number[], pool: Rgb): number {
      return Math.min(...fills.flatMap((fill) => Object.values(words).map((text) => contrast(text, mix(raised, fill, pool)))));
    }

    // Dark: a picked colour is mixed toward black. White is the brightest pick there can be.
    const darkWords = texts(
      colour(darkTokens, "--color-ink"),
      colour(darkTokens, "--color-ink-soft"),
      mix(brand, share(darkTokens, "--color-primary"), WHITE),
      colour(darkTokens, "--color-success"),
      colour(darkTokens, "--color-danger"),
      [0.86, 0.9, 0.86],
      WHITE
    );
    const darkFills = [share(darkGlass, "--lg-panel"), share(darkGlass, "--lg-nav")];
    const darkShares = ["brand", "peach", "violet", "pink"].map((pool) => share(darkGlass, `--lg-pick-${pool}`));
    const toneRule = rule(looks, ':root[data-look="dark"][data-tone]');
    const raisedStops = /--color-paper-raised: color-mix\(in srgb, color-mix\(in srgb, (#[0-9a-f]{6}) var\(--tone-mid\), (#[0-9a-f]{6})\), (#[0-9a-f]{6}) var\(--tone-slate\)\);/.exec(toneRule)!;
    for (const raised of raisedStops.slice(1).map(rgb)) {
      for (const pick of [...picks, "#ffffff", "#ffff00", "#00ff00"]) {
        for (const amount of darkShares) {
          expect(worst(darkWords, raised, darkFills, mix(rgb(pick), amount, BLACK)), `dark, ${pick} at ${amount} on ${toHex(raised)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }

    // Light: a picked colour is mixed toward white. Black is the darkest pick there can be.
    const lightWords = texts(
      colour(lightTokens, "--color-ink"),
      colour(lightTokens, "--color-ink-soft"),
      brand,
      colour(lightTokens, "--color-success"),
      colour(lightTokens, "--color-danger"),
      [0.86, 0.86, 0.88],
      BLACK
    );
    const lightFills = [share(lightGlass, "--lg-panel"), share(lightGlass, "--lg-nav")];
    const lightShares = ["brand", "peach", "violet", "pink"].map((pool) => share(lightGlass, `--lg-pick-${pool}`));
    for (const pick of [...picks, "#000000", "#0000ff", "#ff0000"]) {
      for (const amount of lightShares) {
        expect(worst(lightWords, WHITE, lightFills, mix(rgb(pick), amount, WHITE)), `light, ${pick} at ${amount}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("the side menu's group headings", () => {
  const tokens = read("ui/theme/tokens.css");
  const menuCss = read("ui/theme/glass/menu.css");

  it("are drawn in the brand, in the side menu, the pinned group and the phone menu", () => {
    const heading = /className="zimos-menu-heading [^"]*"/.exec(read("components/shell/SidebarNav.tsx"))?.[0] ?? "";
    expect(heading).toContain("text-[12px] font-semibold text-primary");
    expect(heading).not.toContain("text-ink-soft");
    expect(read("components/SidebarShortcuts.tsx")).toContain('"min-w-0 flex-1 truncate font-semibold text-primary", sheet ? "text-[13px]" : "text-[12px]"');
    expect(read("components/shell/PhoneMenu.tsx")).toMatch(/<h3 id=\{headingId\} className="[^"]*text-\[13px\] font-semibold tracking-normal text-primary"/);
  });

  it("take the brand's pane shade with glass on, and full ink when pointed at", () => {
    const brandRule = menuCss.indexOf(".glass-app .zimos-menu-heading.text-primary {");
    const hoverRule = menuCss.indexOf(".glass-app .zimos-menu-heading:is(:hover, :focus-visible) {");
    expect(brandRule).toBeGreaterThan(0);
    expect(menuCss.slice(brandRule, menuCss.indexOf("}", brandRule))).toContain("color: var(--lg-text-primary);");
    // Same weight of selector: the pointed-at rule comes after, so it still wins.
    expect(hoverRule).toBeGreaterThan(brandRule);
  });

  it("hold 4.5:1 on the light side menu and phone menu without glass; Dark, Black, the tone and the glass panes are held above", () => {
    // Without glass both menus are the raised surface. The dark looks and every tone hold `primary`
    // in "keeps text and the accents at 4.5:1 or better on every surface", and the glass pane holds
    // --lg-text-primary in "keeps text at 4.5:1 over the brightest palette".
    const light = tokens.slice(0, tokens.indexOf("\n.dark {"));
    const brand = colour(tokens, "--brand");
    expect(contrast(brand, colour(light, "--color-paper-raised"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brand, colour(light, "--color-paper"))).toBeGreaterThanOrEqual(4.5);
    const dark = rule(tokens, "\n.dark");
    expect(contrast(mix(brand, share(dark, "--color-primary"), WHITE), colour(dark, "--color-paper-raised"))).toBeGreaterThanOrEqual(4.5);
  });
});
