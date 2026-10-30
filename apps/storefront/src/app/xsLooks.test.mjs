import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { hashOf, xsLookBundles } from "../../scripts/xs-look-css.mjs";

/**
 * The imported templates' looks are not in every page: app/xs.css carries the
 * shared base, and each look is one small file a page links only when it
 * draws that look (scripts/xs-look-css.mjs, components/xs/XsLookStyles).
 * These pin that split, and that every file the store links is the one its
 * sources make today.
 */

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("../lib/xsLookCss.json"));
const publicFile = (href) => new URL(`../../public${href}`, import.meta.url);

describe("the imported templates' stylesheets", () => {
  it("leave only the shared base in every page", () => {
    const imports = [...read("./xs.css").matchAll(/^@import\s+"([^"]+)";/gm)].map((match) => match[1]);
    assert.deepEqual(imports, ["./xs-sections.css", "./xs-pages.css", "./xs-home.css", "./xs-shell.css", "./xs-store.css"]);
  });

  it("give every look its own file, and only the looks there are", () => {
    const files = readdirSync(new URL(".", import.meta.url))
      .map((name) => /^xs-look-(\d\d)\.css$/.exec(name)?.[1])
      .filter(Boolean);
    assert.deepEqual(Object.keys(manifest.looks).sort(), [...new Set(["01", ...files])].sort());
    const credits = read("../lib/xsShell.ts");
    for (const look of Object.keys(manifest.looks)) assert.match(credits, new RegExp(`"${look}":`), `look ${look} has no credit`);
  });

  it("are built from the sources as they are now", () => {
    const bundles = xsLookBundles();
    for (const [look, css] of Object.entries(bundles.looks)) {
      assert.equal(manifest.looks[look], `/xs/${look}/look.${hashOf(css)}.css`, `look ${look} is stale: run node scripts/xs-look-css.mjs`);
      assert.ok(existsSync(publicFile(manifest.looks[look])), `${manifest.looks[look]} is missing`);
    }
    assert.equal(manifest.phone, `/xs/phone.${hashOf(bundles.phone)}.css`);
    assert.ok(existsSync(publicFile(manifest.phone)));
  });

  it("carry the faces each look is set in — Latin and its Arabic pairing — and no other look's", () => {
    const bundles = xsLookBundles();
    const faces = (css) => [...css.matchAll(/@font-face\{font-family:"?([^;"]+)"?;/g)].map((match) => match[1]);
    assert.deepEqual([...new Set(faces(bundles.looks["01"]))].sort(), [
      "XS Ar El Messiri",
      "XS Ar Tajawal",
      "XS01 Display",
      "XS01 Display Fallback",
      "XS01 Display Fallback Android",
      "XS01 Sans",
      "XS01 Sans Fallback",
      "XS01 Sans Fallback Android",
    ]);
    assert.deepEqual([...new Set(faces(bundles.looks["05"]))].sort(), ["Nunito Sans", "XS Ar Almarai"]);
    assert.deepEqual([...new Set(faces(bundles.looks["03"]))].sort(), ["Jost", "Marcellus", "XS Ar Amiri", "XS Ar Tajawal"]);
    // Every face is a woff2 limited to its script (unicode-range): no Arabic letter is drawn in a Latin face, nor the reverse.
    for (const css of Object.values(bundles.looks)) {
      for (const face of css.match(/@font-face\{[^}]*\}/g) ?? []) {
        assert.match(face, /unicode-range:/);
        if (/font-family:"?[^;"]+ Fallback( Android)?"?;/.test(face)) {
          // A sized system face standing in while the web face is on its way: nothing is downloaded for it.
          assert.match(face, /src:local\(/);
          assert.match(face, /size-adjust:/);
          assert.doesNotMatch(face, /url\(/);
          continue;
        }
        assert.match(face, /format\("woff2"\)/);
        assert.match(face, /font-display:swap/);
      }
    }
  });

  it("name each sized fallback face right after the face it stands in for, Android's after the others", () => {
    for (const [look, css] of Object.entries(xsLookBundles().looks)) {
      for (const [, family] of css.matchAll(/"([^"]+) Fallback(?: Android)?"/g)) {
        assert.match(
          css,
          new RegExp(`"${family}",\\s*"${family} Fallback",\\s*"${family} Fallback Android"`),
          `look ${look}: "${family}"'s fallbacks are not right after it`,
        );
      }
    }
    const shared = read("./xs-sections.css");
    assert.match(shared, /--xs-sans: "XS01 Sans", "XS01 Sans Fallback", "XS01 Sans Fallback Android",/);
    assert.match(shared, /--xs-display: "XS01 Display", "XS01 Display Fallback", "XS01 Display Fallback Android",/);
  });

  it("size Android's fallbacks on its own system faces", () => {
    const fonts = read("./xs-fonts.css");
    const face = (family) => new RegExp(`@font-face \\{\\s*font-family: "${family}";\\s*src: ([^;]+);`).exec(fonts)?.[1];
    assert.equal(face("XS01 Sans Fallback Android"), 'local("Roboto"), local("Roboto-Regular")');
    assert.equal(face("XS01 Display Fallback Android"), 'local("Noto Serif"), local("NotoSerif-Regular")');
  });

  it("are linked by the store's layout and by the page renderer", () => {
    const layout = read("./store/[workspaceId]/layout.tsx");
    assert.match(layout, /<XsLookStyles looks=\{\[xsShell\]\} \/>/);
    assert.match(layout, /<XsPhoneStyles \/>/);
    assert.match(read("../components/page-renderer/PageRenderer.tsx"), /<XsPageStyles tree=\{tree\} \/>/);
  });
});
