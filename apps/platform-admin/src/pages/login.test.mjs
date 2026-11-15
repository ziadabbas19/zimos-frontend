import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The console's sign-in page is the merchant dashboard's: the same frame
 * (`.auth-glass` of the shared theme), the same field and button shapes. The
 * console has one screen outside it — there is no sign-up and no password
 * reset here. This app's tests run without a DOM, so they read the sources.
 */
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const shell = read("../components/AuthShell.tsx");
const dashboardShell = read("../../../merchant-dashboard/src/pages/AuthShell.tsx");
const page = read("./LoginPage.tsx");

function classOf(source, anchor) {
  const at = source.indexOf(anchor);
  assert.ok(at >= 0, `not found: ${anchor}`);
  const found = /className="([^"]+)"/.exec(source.slice(at));
  assert.ok(found, `no className after ${anchor}`);
  return found[1];
}
const constant = (source, name) => new RegExp(`export const ${name} = "([^"]+)";`).exec(source)?.[1];

/** The `en` or `ar` block of the page's STRINGS, as key → text. */
function strings(locale) {
  const block = new RegExp(`\\n  ${locale}: \\{([\\s\\S]*?)\\n  \\},`).exec(page)?.[1];
  assert.ok(block, `no ${locale} strings`);
  return Object.fromEntries([...block.matchAll(/^\s{4}(\w+): "((?:[^"\\]|\\.)*)",$/gm)].map((m) => [m[1], m[2]]));
}

describe("the sign-in page's frame is the merchant dashboard's", () => {
  it("the wallpaper, the mark at the top and the one card", () => {
    assert.match(shell, /<div className="auth-glass">/);
    assert.match(dashboardShell, /<div className="auth-glass">/);
    assert.equal(classOf(shell, "<header"), classOf(dashboardShell, "<header"));
    assert.match(shell, /<main className="auth-glass-stage">/);
    assert.match(dashboardShell, /<main className="auth-glass-stage">/);
    assert.match(shell, /<ZimosLogo height=\{30\} \/>/);
    assert.match(dashboardShell, /<ZimosLogo height=\{30\} \/>/);
    assert.match(shell, /data-slot="auth-card"/);
    // The dashboard's narrow card.
    assert.match(shell, /"w-full max-w-\[26rem\] min-w-0"/);
    assert.match(dashboardShell, /sm: "max-w-\[26rem\]"/);
  });

  it("the language switch sits in the corner, before signing in", () => {
    assert.match(shell, /data-slot="auth-corner"/);
    assert.match(shell, /<LanguageToggle className="h-11" \/>/);
    assert.match(dashboardShell, /<LanguageSwitch className="h-11" \/>/);
    // The console had its light / dark switch on this page: it stays.
    assert.match(shell, /<ThemeToggle \/>/);
  });

  it("the title, the fields, the eye and the button take the dashboard's shapes", () => {
    for (const name of ["AUTH_INPUT", "AUTH_SUBMIT"]) {
      assert.ok(constant(shell, name), name);
      assert.equal(constant(shell, name), constant(dashboardShell, name), name);
    }
    assert.equal(classOf(shell, "<h1"), classOf(dashboardShell, "<h1"));
    assert.equal(classOf(shell, "aria-pressed={shown}"), classOf(dashboardShell, "aria-pressed={shown}"));
    assert.match(page, /<Button type="submit" className=\{AUTH_SUBMIT\} disabled=\{submitting\}>/);
  });
});

describe("the sign-in page's words", () => {
  const en = strings("en");
  const ar = strings("ar");

  it("says in English what it said before it was redrawn", () => {
    assert.equal(en.title, "Admin sign in");
    assert.equal(en.subtitle, "Restricted to Zimos team accounts.");
    assert.equal(en.email, "Email");
    assert.equal(en.password, "Password");
    assert.equal(en.signIn, "Sign in");
    assert.equal(en.signingIn, "Signing in…");
    assert.equal(en.wrong, "Incorrect email or password.");
    assert.equal(en.unreachable, "Can't reach the server. Check that the backend is running and try again.");
    // The two sentences of the panel that stood beside the form.
    assert.equal(en.tagline, "A clear view across every store on the platform.");
    assert.equal(en.note, "Internal tooling for the Zimos team — not a merchant-facing surface.");
  });

  it("has every string in Arabic too", () => {
    assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
    assert.ok(Object.keys(en).length >= 10);
    for (const [key, value] of Object.entries(ar)) assert.ok(value.trim().length > 0, key);
  });

  it("still signs in the way it did: the same call, the same code step, the same way back", () => {
    assert.match(page, /await login\(\{ email, password \}\);/);
    assert.match(page, /if \(TWO_FACTOR_ENABLED && err instanceof TwoFactorRequiredError\) \{/);
    assert.match(page, /await verifyCode\(\{ challengeToken: challenge\.challengeToken, code \}\);/);
    assert.match(page, /navigate\(from, \{ replace: true \}\);/);
    assert.match(page, /fieldId="email"/);
    assert.match(page, /fieldId="password"/);
  });
});
