// Test harness: starts the merchant dashboard's Vite dev server, opens pages
// whose every /api request is answered by a stub, and blocks every request
// that leaves the dashboard's own origin. No backend, no courier, no network.

import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { ME, WS, apiError, ok } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DASHBOARD = path.join(ROOT, "apps", "merchant-dashboard");

// ---------------------------------------------------------------- results

let passes = 0;
let failures = 0;

export function check(cond, label) {
  if (cond) {
    passes++;
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

export function fail(label) {
  check(false, label);
}

export const results = () => ({ passes, failures });

// ---------------------------------------------------------------- server

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * The dashboard to test: E2E_BASE_URL when set (a server you already run),
 * otherwise a fresh Vite dev server on a free port, stopped by `stop()`.
 */
export async function startDashboard() {
  if (process.env.E2E_BASE_URL) return { baseUrl: process.env.E2E_BASE_URL.replace(/\/$/, ""), stop: async () => {} };

  const port = await freePort();
  const vite = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [vite, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: DASHBOARD,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Vite exited early:\n${output}`);
    try {
      const res = await fetch(baseUrl);
      if (res.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`Vite did not start within 90s:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const stop = async () => {
    if (child.exitCode !== null) return;
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore" });
      } catch {
        // already gone
      }
    } else {
      child.kill("SIGTERM");
    }
  };
  return { baseUrl, stop };
}

export async function launchBrowser() {
  return chromium.launch();
}

// ---------------------------------------------------------------- pages

/** What every page needs to get past the auth and workspace gates. */
function defaults(method, apiPath, role) {
  if (apiPath.startsWith("/auth/me")) {
    return ok({
      user: { id: ME, email: "me@example.test", fullName: "Me Owner", phone: null, status: "active", platformAdmin: false },
    });
  }
  if (apiPath === "/workspaces") {
    return ok({
      workspaces: [
        { workspace: { id: WS, name: "Test store", slug: "test", settings: {}, themeSettings: {} }, role: { key: role, name: role } },
      ],
    });
  }
  if (apiPath.includes("/payment-timeline")) return apiError(404, "NOT_FOUND", "Not stubbed");
  if (apiPath.endsWith("/returns")) return ok({ returns: [] });
  if (apiPath.includes("/shipping/weight-tiers")) {
    return ok({ pricingMode: "flat", defaultItemWeightGrams: null, tiers: [], prices: [], variantsWithoutWeight: 0 });
  }
  return apiError(404, "NOT_FOUND", `Not stubbed: ${method} ${apiPath}`);
}

/**
 * A fresh browser context signed in with a placeholder token (it grants
 * nothing: every API answer comes from `handler(method, path, body)`, or
 * from `defaults` when the handler returns undefined). Every API request is
 * recorded; anything leaving the dashboard's origin is aborted and recorded.
 */
export async function openPage(browser, baseUrl, { handler, locale = "en", role = "owner" } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addInitScript(
    ({ ws, locale }) => {
      // Seeded once: addInitScript runs on every navigation.
      if (!localStorage.getItem("sb.accessToken")) {
        localStorage.setItem("sb.accessToken", "e2e-placeholder-token");
        localStorage.setItem("sb.refreshToken", "e2e-placeholder-refresh");
        localStorage.setItem("sb.currentWorkspaceId", ws);
        localStorage.setItem("zimos.locale", locale);
      }
      // pageerror doesn't fire for unhandled promise rejections.
      window.__rejections = [];
      window.addEventListener("unhandledrejection", (e) => window.__rejections.push(String(e.reason)));
    },
    { ws: WS, locale }
  );

  const origin = new URL(baseUrl).origin;
  const requests = [];
  const blocked = [];
  const errors = [];
  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== origin) {
      blocked.push(req.url());
      return route.abort();
    }
    if (!url.pathname.startsWith("/api/")) return route.continue();

    const apiPath = url.pathname.replace(/^\/api\/v1/, "") + url.search;
    let body = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    requests.push({ method: req.method(), path: apiPath, body });
    const res = (handler && (await handler(req.method(), apiPath, body))) || defaults(req.method(), apiPath, role);
    return route.fulfill({ status: res.status, contentType: "application/json", body: JSON.stringify(res.body) });
  });

  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, context, requests, blocked, errors };
}

/** Request bodies of `method` whose path contains `fragment`, in order. */
export const bodiesOf = (requests, method, fragment) =>
  requests.filter((r) => r.method === method && r.path.includes(fragment)).map((r) => r.body);

export async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}

/** No page error and no unhandled rejection — and proof the listener was there. */
export async function assertClean({ page, errors }, label) {
  const rejections = await page.evaluate(() => (Array.isArray(window.__rejections) ? window.__rejections : null));
  check(Array.isArray(rejections), `${label}: rejection listener installed`);
  const all = [...errors, ...(rejections ?? [])];
  check(all.length === 0, `${label}: no page errors${all.length ? ` (${all.join(" | ")})` : ""}`);
}
