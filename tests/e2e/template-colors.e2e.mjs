// The brand colour on every imported template: each look is drawn from the
// stylesheets the store really links (the shared base, the look's own file and
// the dark file), with a merchant's colour on the store wrapper, and the main
// button and an accent element must come out in that colour, in light and in
// dark. A template that ignores the colour fails here.
//
//   npm run test:colors
//
// Needs Chromium only: no API, no running app.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { check, launchBrowser, results } from "./support/harness.mjs";

const require = createRequire(import.meta.url);
const postcss = require("postcss");

const APP = fileURLToPath(new URL("../../apps/storefront/src/app/", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../../apps/storefront/public", import.meta.url));
const files = JSON.parse(readFileSync(fileURLToPath(new URL("../../apps/storefront/src/lib/xsLookCss.json", import.meta.url)), "utf8"));
const read = (path) => readFileSync(path, "utf8");

const LIGHT = "#00A86B";
const DARK = "#FF00AA";
const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

/** The store wrapper's own rules out of globals.css; the rest of it is Tailwind's. */
function brandRules() {
  const out = [];
  postcss.parse(read(`${APP}globals.css`)).walkRules((rule) => {
    if (rule.parent?.type === "atrule" && rule.parent.name === "theme") return;
    if (/\.brand-theme|:root/.test(rule.selector)) out.push(rule.toString());
  });
  return out.join("\n");
}

const SHARED = ["xs-sections.css", "xs-pages.css", "xs-home.css", "xs-shell.css", "xs-store.css"].map((name) => read(APP + name)).join("\n");

/** The parts every look draws, in the classes the storefront gives them. */
const PARTS = `
  <section data-xs-look="LOOK">
    <a id="main" class="xs-btn" data-tone="solid" href="#">Shop</a>
    <a id="accent" class="xs-btn" data-tone="accent" href="#">Sale</a>
    <span id="token" style="color: var(--xs-accent); background: var(--xs-button)">Token</span>
  </section>`;

function page(look, { mode, own }) {
  const css = [brandRules(), SHARED, read(PUBLIC + files.looks[look]), read(PUBLIC + files.dark)].join("\n");
  const owned = own ? "data-xs-own-accent data-xs-own-accent-dark" : "";
  const style = `--brand-primary-light-mode:${LIGHT};--brand-primary-light-mode-fg:#16211f;--brand-primary-dark-mode:${DARK};--brand-primary-dark-mode-fg:#ffffff`;
  return `<!doctype html><html><head><style>${css}</style></head><body>
    <div class="brand-theme" data-xs-shell="${look}" ${owned} ${mode === "dark" ? 'data-color-mode="dark"' : ""} style="${style}">${PARTS.replace("LOOK", look)}</div>
  </body></html>`;
}

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const tab = await context.newPage();
const NATIVE_DARK = new Set(["19", "22"]);

const read3 = () =>
  tab.evaluate(() => {
    const paint = (id) => {
      const style = getComputedStyle(document.getElementById(id));
      return { background: style.backgroundColor, color: style.color, border: style.borderTopColor };
    };
    return { main: paint("main"), accent: paint("accent"), token: paint("token") };
  });

for (const look of Object.keys(files.looks).sort()) {
  for (const mode of ["light", "dark"]) {
    if (mode === "dark" && NATIVE_DARK.has(look)) continue;
    const want = rgb(mode === "dark" ? DARK : LIGHT);
    await tab.setContent(page(look, { mode, own: true }));
    const drawn = await read3();
    // Filled in most looks; a look whose button is a white pill or an underlined word carries it in its words or its line.
    check(Object.values(drawn.main).includes(want), `look ${look} ${mode}: the main button carries the store's colour (${JSON.stringify(drawn.main)})`);
    check(drawn.token.color === want && drawn.token.background === want, `look ${look} ${mode}: the accent tokens are the store's colour`);
    check(Object.values(drawn.accent).includes(want), `look ${look} ${mode}: an accent element is the store's colour (${JSON.stringify(drawn.accent)})`);

    // A store that never picked a colour keeps the template's own.
    await tab.setContent(page(look, { mode, own: false }));
    const untouched = await read3();
    check(untouched.token.background !== want, `look ${look} ${mode}: without a colour of its own the template keeps its palette`);
  }
}

await browser.close();
const { passes, failures } = results();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
