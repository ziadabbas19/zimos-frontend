// The merchant's logo in every imported template's header: a square 192x192
// logo and a wide 600x150 one must leave the header exactly as tall, stay
// inside its bar and keep their proportions, on a computer and on a phone,
// left to right and right to left.
//
//   npm run test:logos
//
// Needs Chromium only: no API, no running app.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { check, launchBrowser, results } from "./support/harness.mjs";

const APP = fileURLToPath(new URL("../../apps/storefront/src/app/", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../../apps/storefront/public", import.meta.url));
const files = JSON.parse(readFileSync(fileURLToPath(new URL("../../apps/storefront/src/lib/xsLookCss.json", import.meta.url)), "utf8"));
const read = (path) => readFileSync(path, "utf8");
const SHARED = ["xs-sections.css", "xs-pages.css", "xs-home.css", "xs-shell.css", "xs-store.css"].map((name) => read(APP + name)).join("\n");

/** A flat picture of this size, drawn by the page itself. */
const picture = (width, height) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><rect x="10%" y="10%" width="80%" height="80%" fill="#e8415b"/></svg>`)}`;

const SQUARE = picture(192, 192);
const WIDE = picture(600, 150);

function page(look, logo, dir, size) {
  const css = [SHARED, read(PUBLIC + files.looks[look]), read(PUBLIC + files.phone)].join("\n");
  return `<!doctype html><html dir="${dir}"><head><style>${css}</style></head><body>
    <div class="brand-theme" data-xs-shell="${look}">
      <header class="xs-header" data-xs-look="${look}" ${size ? `data-logo-size="${size}"` : ""}>
        <div class="xs-header__bar"><div class="xs-header__bar-inner">
          <a class="xs-header__logo" data-logo-source="store" href="#"><img class="xs-header__logo-img" alt="" width="160" height="54" src="${logo}"></a>
        </div></div>
      </header>
    </div>
  </body></html>`;
}

const browser = await launchBrowser();
const VIEWS = [["computer", 1440, 900, 48], ["phone", 390, 844, 40]];

async function measure(tab, look, logo, dir, size) {
  await tab.setContent(page(look, logo, dir, size));
  await tab.waitForFunction(() => document.querySelector(".xs-header__logo-img").complete);
  return tab.evaluate(() => {
    const bar = document.querySelector(".xs-header__bar").getBoundingClientRect();
    const header = document.querySelector(".xs-header").getBoundingClientRect();
    const img = document.querySelector(".xs-header__logo-img").getBoundingClientRect();
    return { bar: bar.height, header: header.height, height: img.height, width: img.width, above: bar.top - img.top, below: img.bottom - bar.bottom };
  });
}

for (const [view, width, height, tall] of VIEWS) {
  const context = await browser.newContext({ viewport: { width, height } });
  const tab = await context.newPage();
  for (const look of Object.keys(files.looks).sort()) {
    for (const dir of ["ltr", "rtl"]) {
      const square = await measure(tab, look, SQUARE, dir);
      const wide = await measure(tab, look, WIDE, dir);
      const where = `look ${look} ${view} ${dir}`;
      check(square.header === wide.header && square.bar === wide.bar, `${where}: the header is as tall with either logo (${square.header} / ${wide.header})`);
      check(square.above <= 0 && square.below <= 0, `${where}: the square logo stays inside the bar (${square.above} / ${square.below})`);
      check(wide.above <= 0 && wide.below <= 0, `${where}: the wide logo stays inside the bar`);
      check(square.height <= tall, `${where}: the square logo is at most ${tall}px tall (${square.height})`);
      check(Math.abs(square.width - square.height) <= 1, `${where}: the square logo stays square (${square.width}x${square.height})`);
      check(wide.width <= Math.min(260, width * 0.46) + 1, `${where}: the wide logo keeps to its width (${wide.width})`);
    }
    const small = await measure(tab, look, SQUARE, "ltr", "sm");
    const large = await measure(tab, look, SQUARE, "ltr", "lg");
    check(small.height < large.height || large.height === large.bar, `look ${look} ${view}: Small draws the logo smaller than Large (${small.height} / ${large.height})`);
    check(large.above <= 0 && large.below <= 0, `look ${look} ${view}: Large still stays inside the bar`);
  }
  await context.close();
}

await browser.close();
const { passes, failures } = results();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
