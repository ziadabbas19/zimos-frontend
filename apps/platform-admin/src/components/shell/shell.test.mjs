import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LOOK_STRINGS, NAV_LABELS_AR, SHELL_STRINGS, SIGN_OUT_STRINGS } from "../../lib/shellStrings.ts";

/**
 * The console's frame is the merchant dashboard's: the side menu, the toolbar,
 * the phone dock and the menu sheet are written here against the dashboard's
 * own class names, which the shared theme (packages/ui/src/theme) draws. The
 * two apps keep their own menus, permissions and words, so the markup is two
 * files — and these checks are what keep them one look: when the dashboard's
 * frame changes, the same change is due here. This app's tests run without a
 * DOM, so they read the sources.
 */
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const dashboard = (path) => read(`../../../../merchant-dashboard/src/components/${path}`);

const adminLayout = read("../AdminLayout.tsx");
const dashboardLayout = dashboard("DashboardLayout.tsx");

/** The `className="…"` that follows `anchor` in a source file. */
function classAfter(source, anchor) {
  const at = source.indexOf(anchor);
  assert.ok(at >= 0, `not found: ${anchor}`);
  const found = /className="([^"]+)"/.exec(source.slice(at));
  assert.ok(found, `no className after ${anchor}`);
  return found[1];
}
/** The string (or strings joined by +) a `const NAME =` is set to. */
function constant(source, name) {
  const found = new RegExp(`const ${name} =\\s*((?:"[^"]*"(?:\\s*\\+\\s*)?)+);`).exec(source);
  assert.ok(found, `no const ${name}`);
  return [...found[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]).join("");
}

describe("the console's frame is the merchant dashboard's", () => {
  it("the three panes carry the dashboard's own classes", () => {
    assert.match(adminLayout, /<div className="glass-app flex min-h-screen" data-focus=\{focus \? "on" : undefined\}>/);
    assert.match(dashboardLayout, /<div className="glass-app flex min-h-screen" data-focus=\{focus \? "on" : undefined\}>/);
    for (const slot of ['data-slot="side-menu"', 'data-slot="toolbar"']) {
      assert.equal(classAfter(adminLayout, slot), classAfter(dashboardLayout, slot), slot);
    }
    assert.equal(classAfter(adminLayout, "<main"), classAfter(dashboardLayout, "<main"));
    // Hide / show the side menu: the same round button, and the same key on the device.
    assert.equal(classAfter(adminLayout, "onClick={toggleFocus}"), classAfter(dashboardLayout, "onClick={toggleFocus}"));
    assert.match(adminLayout, /const FOCUS_KEY = "zimos\.focus";/);
    assert.match(dashboardLayout, /localStorage\.getItem\("zimos\.focus"\)/);
  });

  it("a page settles in and is centred the way a dashboard page is", () => {
    assert.match(adminLayout, /<div key=\{location\.pathname\.split\("\/"\)\[1\] \?\? ""\} className="page-in">/);
    assert.match(dashboardLayout, /<div key=\{location\.pathname\.split\("\/"\)\[1\] \?\? ""\} className="page-in">/);
  });

  it("a row of the side menu and a tile of the phone menu are the dashboard's", () => {
    const mine = read("./SidebarNav.tsx");
    const theirs = dashboard("shell/SidebarNav.tsx");
    for (const name of ["ROW", "ROW_RAIL", "ROW_SHEET"]) assert.equal(constant(mine, name), constant(theirs, name), name);
    // The heading that folds a group, and the list that fades at both ends.
    assert.equal(classAfter(mine, "onClick={() => toggle(group.id)}"), classAfter(theirs, "onClick={() => toggle(group.id)}"));
    assert.match(mine, /className="zimos-menu-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2\.5 pt-2\.5 pb-5 \[scrollbar-width:none\] \[&::-webkit-scrollbar\]:hidden/);
    assert.match(theirs, /className="zimos-menu-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2\.5 pt-2\.5 pb-5 \[scrollbar-width:none\] \[&::-webkit-scrollbar\]:hidden/);
    assert.match(mine, /<ZimosLogo height=\{22\} \/>/);
  });

  it("the phone dock is the dashboard's, slot for slot", () => {
    const mine = read("./Dock.tsx");
    const theirs = dashboard("MobileTabBar.tsx");
    for (const name of ["SLOT", "PILL", "LABEL"]) assert.equal(constant(mine, name), constant(theirs, name), name);
    assert.equal(classAfter(mine, 'data-slot="dock"'), classAfter(theirs, 'data-slot="dock"'));
    // The lens filter the theme's dock.css names.
    assert.match(mine, /<filter id="lg-dock-distort"/);
    const lens = (source) => /"(zimos-dock-lens [^"]+)"/.exec(source)?.[1];
    assert.ok(lens(mine));
    assert.equal(lens(mine), lens(theirs));
  });

  it("the phone menu is the dashboard's sheet", () => {
    const mine = read("./PhoneMenu.tsx");
    const theirs = dashboard("shell/PhoneMenu.tsx");
    const sheet = (source) => /"(zimos-phone-menu relative [^"]+)"/.exec(source)?.[1];
    assert.ok(sheet(mine));
    assert.equal(sheet(mine), sheet(theirs));
    for (const hook of ["zimos-phone-menu-backdrop", "zimos-phone-menu-grab", "zimos-phone-menu-close"]) {
      const cls = (source) => new RegExp(`className="(${hook}[^"]*)"`).exec(source)?.[1];
      assert.ok(cls(mine), hook);
      assert.equal(cls(mine), cls(theirs), hook);
    }
    // A group's heading in the sheet, in the brand like the side menu's.
    assert.equal(classAfter(mine, "<h3 id={headingId}"), classAfter(theirs, "<h3 id={headingId}"));
    assert.match(mine, /data-slot="phone-menu"/);
  });

  it("the account menu and the breadcrumb are the dashboard's", () => {
    const mine = read("./AccountMenu.tsx");
    const theirs = dashboard("shell/AccountMenu.tsx");
    assert.equal(constant(mine, "ITEM"), constant(theirs, "ITEM"));
    assert.equal(classAfter(mine, "title={t.accountMenu}"), classAfter(theirs, "title={t.accountMenu}"));
    assert.equal(classAfter(mine, "<DropdownMenuContent"), classAfter(theirs, "<DropdownMenuContent"));
    assert.equal(constant(read("./Breadcrumbs.tsx"), "PAGE"), constant(dashboard("shell/Breadcrumbs.tsx"), "PAGE"));
  });

  it("the search of the toolbar is the dashboard's search field", () => {
    const trigger = (source) => {
      const at = source.indexOf('data-slot="spotlight-trigger"');
      assert.ok(at >= 0);
      const block = source.slice(at, source.indexOf("</button>", at));
      return [...block.matchAll(/"((?:zimos-spotlight-trigger|transition-\[|hover:bg-paper-sunken|pointer-fine:|lg:h-9)[^"]*)"/g)].map((m) => m[1]);
    };
    const mine = trigger(read("./GlobalSearch.tsx"));
    assert.equal(mine.length, 5);
    assert.deepEqual(mine, trigger(dashboard("CommandPalette.tsx")));
  });

  it("the look is chosen with the dashboard's own controls, from the same store", () => {
    const dialog = read("./AppearanceDialog.tsx");
    assert.match(dialog, /import \{ Segmented \} from "@store-builder\/ui";/);
    assert.match(dialog, /import \{ GlowColours, ToneSlider, setGlass, setLook, setTone, useAppearance \} from "@store-builder\/ui\/appearance";/);
    for (const look of ["light", "black", "dark"]) assert.ok(dialog.includes(`{ value: "${look}", label: t.${look},`), look);
    // The dashboard's section draws the same five rows.
    const section = read("../../../../merchant-dashboard/src/pages/settings/AppearanceSection.tsx");
    // Both draw the new look as a circle from the segment pressed, like the toolbar switch (@store-builder/ui/theme-reveal).
    for (const source of [dialog, section]) {
      assert.match(source, /import \{ animateThemeChange \} from "@store-builder\/ui\/theme-reveal";/);
      assert.ok(source.includes("onChange={(next, press) => animateThemeChange(press, () => setLook(next))}"));
    }
    for (const key of ["language", "look", "tone", "glass", "glow"]) {
      assert.ok(dialog.includes(`label={t.${key}}`), key);
      assert.ok(section.includes(`label={t.${key}}`), key);
    }
  });
});

describe("the console's words", () => {
  for (const [name, table] of Object.entries({ SHELL_STRINGS, LOOK_STRINGS, SIGN_OUT_STRINGS })) {
    it(`${name} has every string in Arabic too`, () => {
      assert.deepEqual(Object.keys(table.ar).sort(), Object.keys(table.en).sort());
      for (const [key, value] of Object.entries(table.ar)) assert.ok(value.trim().length > 0, key);
    });
  }

  it("keeps what the shell said before it was redrawn", () => {
    assert.equal(SHELL_STRINGS.en.platformAdmin, "Platform Admin");
    assert.equal(SHELL_STRINGS.en.searchPlaceholder, "Search workspaces…");
    assert.equal(SHELL_STRINGS.en.signOut, "Sign out");
    assert.equal(SIGN_OUT_STRINGS.en.title, "Sign out?");
    assert.equal(SIGN_OUT_STRINGS.en.body, "You'll need to sign in again to open the console.");
    assert.equal(NAV_LABELS_AR.Overview, "نظرة عامة");
  });

  it("the look's rows say what the dashboard's say", () => {
    const section = read("../../../../merchant-dashboard/src/pages/settings/AppearanceSection.tsx");
    for (const key of ["lookHint", "toneHint", "glassHint", "glassSystem", "glassBlack", "glowHint", "deviceNote"]) {
      assert.ok(section.includes(`${key}: "${LOOK_STRINGS.en[key]}"`), `en ${key}`);
      assert.ok(section.includes(`${key}: "${LOOK_STRINGS.ar[key]}"`), `ar ${key}`);
    }
  });
});
