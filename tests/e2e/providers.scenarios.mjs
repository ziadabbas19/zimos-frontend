// Provider logos (couriers and payment gateways), the carrier sandbox errors
// and badge, and CARRIER_PERMISSION_DENIED. Registered in carriers.e2e.mjs,
// which runs every scenario against the fully stubbed API.

import {
  BOSTA,
  FAKEGATE,
  FAKEMANUAL,
  FAKEPOLL,
  JTEXPRESS,
  KASHIER,
  MYLERZ,
  ORDER,
  PAYMOB,
  WS,
  apiError,
  ok,
  order,
  payment,
  paymentTimeline,
  shipment,
} from "./support/fixtures.mjs";
import { assertClean, bodiesOf, check, openPage, settle } from "./support/harness.mjs";

const carriersPath = `/workspaces/${WS}/carriers`;
const orderPath = `/workspaces/${WS}/orders/${ORDER}`;
const paymentsPath = `/workspaces/${WS}/payments`;
const envKey = (code) => `zimos_carrier_env_${WS}_${code}`;

/** The card (courier or gateway) whose heading is `name`. */
const cardOf = (page, name) =>
  page.getByRole("heading", { name, exact: true }).locator(
    "xpath=ancestor::div[contains(concat(' ', @class, ' '), ' p-4 ') or contains(concat(' ', @class, ' '), ' p-5 ')][1]"
  );

/** The fixed logo box per size variant (CSS px): every logo and fallback renders at exactly this size. */
const BOX = { sm: "56x28", md: "72x36" };

/**
 * A real logo: the visible <img> with this alt (a hidden theme variant is not
 * in the accessibility tree) loaded from `file`, contained in the whole box of
 * the given size, with no tile behind it.
 */
async function checkLogo(scope, name, file, label, size = "md") {
  const img = scope.getByRole("img", { name, exact: true });
  const count = await img.count();
  const info = await img
    .first()
    .evaluate((el) => {
      const box = el.parentElement;
      const bs = getComputedStyle(box);
      const ib = el.getBoundingClientRect();
      const bb = box.getBoundingClientRect();
      return {
        tag: el.tagName,
        src: el.getAttribute("src") || "",
        variant: el.dataset.variant,
        loaded: el.complete && el.naturalWidth > 0,
        fit: getComputedStyle(el).objectFit,
        filled: Math.round(ib.width) === Math.round(bb.width) && Math.round(ib.height) === Math.round(bb.height),
        box: `${Math.round(bb.width)}x${Math.round(bb.height)}`,
        tile: [bs.backgroundColor, getComputedStyle(el).backgroundColor, bs.borderTopWidth, bs.paddingTop],
      };
    })
    .catch(() => null);
  check(count === 1 && info?.tag === "IMG", `${label}: one visible <img alt="${name}"> (${count})`);
  check(Boolean(info?.src.includes(file)), `${label}: served from ${file} (${info?.src})`);
  check(Boolean(info?.loaded), `${label}: image loaded`);
  check(info?.fit === "contain" && info.filled, `${label}: contained in the whole box (object-fit ${info?.fit})`);
  check(info?.box === BOX[size], `${label}: ${size} box is ${BOX[size]} (${info?.box})`);
  check(
    info?.tile.join("|") === "rgba(0, 0, 0, 0)|rgba(0, 0, 0, 0)|0px|0px",
    `${label}: no tile, the logo sits on the page (${info?.tile.join(" / ")})`
  );
  return info;
}

/** The no-file fallback: a role="img" badge named `name`, showing `initials`, no <img>, in the same box. */
async function checkFallback(scope, name, initials, label, size = "md") {
  const badge = scope.getByRole("img", { name, exact: true }).first();
  const info = await badge
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: el.textContent.trim(),
        fallback: el.hasAttribute("data-fallback"),
        imgs: el.querySelectorAll("img").length,
        box: `${Math.round(r.width)}x${Math.round(r.height)}`,
      };
    })
    .catch(() => null);
  check(info?.tag === "SPAN" && info.fallback && info.imgs === 0, `${label}: initials badge, not an image`);
  check(info?.text === initials, `${label}: initials "${initials}" (got "${info?.text}")`);
  check(info?.box === BOX[size], `${label}: badge fills the ${size} box ${BOX[size]} (${info?.box})`);
}

/** Every logo box on the page, as "WxH". */
const allBoxes = (page) =>
  page.locator("[data-provider-logo]").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    })
  );

/**
 * No provider ships a .dark.png yet, so the dark-variant check registers one
 * in the page only: Vite serves src/lib/providers.ts as a module, and this
 * appends a line to it making `standIn`'s file the dark variant of `code`.
 * Nothing on disk changes. It needs the dev server (a production bundle has
 * no such module), so it reports whether the patch applied.
 */
async function injectDarkVariant(page, code, standIn) {
  let applied = false;
  await page.route(/\/src\/lib\/providers\.ts(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    if (body.includes("const DARK")) {
      body += `\nDARK.set(${JSON.stringify(code)}, LIGHT.get(${JSON.stringify(standIn)}));\n`;
      applied = true;
    }
    await route.fulfill({ response: res, body });
  });
  return () => applied;
}

// ---------------------------------------------------------------- shipping page

export async function shippingLogosAndSandbox(browser, base) {
  console.log("\nH. Shipping page: courier logos in one box size with no tile, fallback, Sandbox badge from the server");
  const session = await openPage(browser, base, {
    handler: (method, path) => {
      if (method === "GET" && path === carriersPath) {
        return ok({
          configured: true,
          carriers: [BOSTA(true), JTEXPRESS(true, { environment: "sandbox" }), MYLERZ(true), FAKEPOLL(false)],
        });
      }
      return undefined;
    },
  });
  const { page } = session;
  await page.goto(`${base}/shipping`);
  await settle(page);
  await checkLogo(cardOf(page, "Bosta"), "Bosta", "bosta", "Bosta card");
  await checkLogo(cardOf(page, "J&T Express"), "J&T Express", "jtexpress", "J&T card");
  await checkLogo(cardOf(page, "Mylerz"), "Mylerz", "mylerz", "Mylerz card");
  await checkFallback(cardOf(page, "FakePoll"), "FakePoll", "FA", "FakePoll card (no file)");

  const sizes = await allBoxes(page);
  check(
    sizes.length === 4 && sizes.every((s) => s === BOX.md),
    `wordmarks, square marks and the fallback share one ${BOX.md} box (${sizes.join(", ")})`
  );

  const jt = cardOf(page, "J&T Express");
  check(await jt.getByText("Sandbox", { exact: true }).isVisible(), "J&T card shows the Sandbox badge");
  check(await jt.getByText(/It only creates test shipments and nothing is delivered/).isVisible(), "J&T card explains the sandbox");
  check((await cardOf(page, "Bosta").getByText("Sandbox", { exact: true }).count()) === 0, "no Sandbox badge on Bosta");
  check((await cardOf(page, "Mylerz").getByText("Sandbox", { exact: true }).count()) === 0, "no Sandbox badge on Mylerz");
  await assertClean(session, "H");
  return session;
}

export async function connectErrors(browser, base, locale = "en") {
  const ar = locale === "ar";
  console.log(`\nI${ar ? "2" : ""}. Connect form (${locale}): environment select, 422 on credentials.environment, CARRIER_PERMISSION_DENIED`);
  const session = await openPage(browser, base, {
    locale,
    handler: (method, path) => {
      if (method === "GET" && path === carriersPath) return ok({ configured: true, carriers: [JTEXPRESS(false), MYLERZ(false)] });
      if (method === "PUT" && path === `${carriersPath}/jtexpress`) {
        return apiError(422, "VALIDATION_ERROR", "Invalid body", [
          {
            field: "credentials.environment",
            message:
              "The J&T Express sandbox only creates test shipments, and it is available to test stores only. Connect a production J&T Express account.",
          },
        ]);
      }
      if (method === "PUT" && path === `${carriersPath}/mylerz`) {
        return apiError(
          422,
          "CARRIER_PERMISSION_DENIED",
          "Mylerz accepted the username and password but refused this request. Ask Mylerz to enable API access for the account."
        );
      }
      return undefined;
    },
  });
  const { page, requests } = session;
  await page.goto(`${base}/shipping`);
  await settle(page);

  const jt = cardOf(page, "J&T Express");
  await jt.getByRole("button", { name: ar ? "ربط J&T Express" : "Connect J&T Express" }).click();
  const env = jt.getByLabel(ar ? "البيئة" : "Environment", { exact: true });
  check((await env.evaluate((el) => el.tagName)) === "SELECT", "environment is a select, not free text");
  check((await env.inputValue()) === "production", "environment defaults to production");
  const optionTexts = await env.locator("option").allTextContents();
  check(
    ar
      ? optionTexts.join("|") === "الإنتاج Production (شحنات حقيقية)|التجربة Sandbox (شحنات تجريبية فقط)"
      : optionTexts.join("|") === "Production (real shipments)|Sandbox (test shipments only)",
    `translated environment options (${optionTexts.join(" | ")})`
  );
  await jt.getByLabel("API account").fill("acc");
  await jt.getByLabel("Private key").fill("pk");
  await jt.getByLabel("Customer code").fill("cc");
  await jt.getByLabel("Customer password").fill("pw");
  await env.selectOption("sandbox");
  await jt.getByRole("button", { name: ar ? "تحقق من المفتاح وتابع" : "Check key and continue" }).click();
  await settle(page);
  const put = bodiesOf(requests, "PUT", "/carriers/jtexpress")[0];
  check(put?.credentials?.environment === "sandbox", `PUT carries environment sandbox (${JSON.stringify(put?.credentials)})`);
  const fieldError = ar
    ? "بيئة التجربة (Sandbox) لدى J&T Express تنشئ شحنات تجريبية فقط، لذلك هي متاحة لمتاجر الاختبار فقط."
    : "The J&T Express sandbox only creates test shipments, so it's available to test stores only.";
  const shown = jt.getByRole("alert").filter({ hasText: fieldError });
  check(await shown.isVisible(), "sandbox 422 shown under the environment field");
  check((await env.getAttribute("aria-invalid")) === "true", "environment field marked invalid");
  const describedBy = (await env.getAttribute("aria-describedby")) ?? "";
  const errorId = await shown.getAttribute("id");
  check(Boolean(errorId) && describedBy.split(" ").includes(errorId), "error linked to the field (aria-describedby)");
  check(
    (await jt.getByText(ar ? "بعض الحقول تحتاج إلى مراجعة" : "Some fields need attention", { exact: false }).count()) === 0,
    "no generic validation banner"
  );
  await env.selectOption("production");
  check((await jt.getByRole("alert").filter({ hasText: fieldError }).count()) === 0, "field error clears on change");

  const mylerz = cardOf(page, "Mylerz");
  await mylerz.getByRole("button", { name: ar ? "ربط Mylerz" : "Connect Mylerz" }).click();
  await mylerz.getByLabel("Username").fill("user");
  await mylerz.getByLabel("Password").fill("secret");
  await mylerz.getByRole("button", { name: ar ? "تحقق من المفتاح وتابع" : "Check key and continue" }).click();
  await settle(page);
  const permission = ar
    ? "قبلت Mylerz تسجيل الدخول، لكنها لم تفعّل الربط عبر API لهذا الحساب. بياناتك صحيحة: اطلب من Mylerz تفعيل الربط عبر API لحسابك"
    : "Mylerz accepted the login, but it hasn't enabled API access for this account. Your details are correct: ask Mylerz to enable API access for your account";
  check(await mylerz.getByText(permission, { exact: false }).isVisible(), "CARRIER_PERMISSION_DENIED: login worked, ask the courier to enable API access");
  check(
    (await mylerz.getByText(ar ? "رفضت شركة الشحن مفتاح API" : "rejected the API key", { exact: false }).count()) === 0,
    "not worded as wrong credentials"
  );
  await assertClean(session, `I${ar ? "2" : ""}`);
  return session;
}

export async function sandboxRemembered(browser, base) {
  console.log("\nJ. Sandbox badge when the server doesn't say: remembered from this browser's connect, cleared on disconnect");
  let connected = false;
  const session = await openPage(browser, base, {
    handler: (method, path) => {
      if (method === "GET" && path === carriersPath) return ok({ configured: true, carriers: [JTEXPRESS(connected)] });
      if (method === "PUT" && path === `${carriersPath}/jtexpress`) {
        connected = true;
        return ok({
          carrier: JTEXPRESS(true),
          webhook: { url: "https://api.example.test/hook", setup: "none", manualSetupRequired: false },
          verification: {},
        });
      }
      if (method === "DELETE" && path === `${carriersPath}/jtexpress`) {
        connected = false;
        return ok({ disconnected: true });
      }
      return undefined;
    },
  });
  const { page } = session;
  await page.goto(`${base}/shipping`);
  await settle(page);
  const jt = cardOf(page, "J&T Express");
  await jt.getByRole("button", { name: "Connect J&T Express" }).click();
  await jt.getByLabel("API account").fill("acc");
  await jt.getByLabel("Private key").fill("pk");
  await jt.getByLabel("Customer code").fill("cc");
  await jt.getByLabel("Customer password").fill("pw");
  await jt.getByLabel("Environment", { exact: true }).selectOption("sandbox");
  await jt.getByRole("button", { name: "Check key and continue" }).click();
  await settle(page);
  check(await jt.getByText("Sandbox", { exact: true }).isVisible(), "Sandbox badge after a beta store's sandbox connect");
  const saved = await page.evaluate((key) => localStorage.getItem(key), envKey("jtexpress"));
  check(Boolean(saved?.includes('"sandbox"')), `environment remembered for this connection (${saved})`);
  await page.reload();
  await settle(page);
  check(await cardOf(page, "J&T Express").getByText("Sandbox", { exact: true }).isVisible(), "badge survives a reload");

  await cardOf(page, "J&T Express").getByRole("button", { name: "Disconnect" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();
  await settle(page);
  check((await cardOf(page, "J&T Express").getByText("Sandbox", { exact: true }).count()) === 0, "badge gone after disconnect");
  check((await page.evaluate((key) => localStorage.getItem(key), envKey("jtexpress"))) === null, "memory cleared on disconnect");

  // A connection the server reports as production wins over a stale memory.
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ environment: "sandbox", connectedAt: "2026-09-01T10:00:00Z" })),
    envKey("jtexpress")
  );
  connected = true;
  await page.route(`**/api/v1${carriersPath}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: true, carriers: [JTEXPRESS(true, { environment: "production" })] }),
    })
  );
  await page.reload();
  await settle(page);
  check(
    (await cardOf(page, "J&T Express").getByText("Sandbox", { exact: true }).count()) === 0,
    "server's environment: production beats the remembered sandbox"
  );
  await assertClean(session, "J");
  return session;
}

// ---------------------------------------------------------------- order page

export async function orderCourierLogosAndErrors(browser, base) {
  console.log("\nK. Order page: logos in the courier picker and shipment rows, sandbox 409 and permission errors on booking");
  const shipments = [
    shipment({ id: "s-mylerz", carrierCode: "mylerz", waybillNumber: "MY-1", trackingCode: "zg-my-1", status: "returned" }),
    shipment({ id: "s-fake", carrierCode: "fakemanual", waybillNumber: "FM-2", trackingCode: "zg-fm-2", status: "cancelled" }),
    shipment({ id: "s-manual", carrierCode: "manual", waybillNumber: null, trackingCode: "zg-hand-3", status: "cancelled", carrierResponse: null }),
  ];
  const session = await openPage(browser, base, {
    handler: (method, path, body) => {
      if (path === carriersPath) {
        return ok({ configured: true, carriers: [BOSTA(true), JTEXPRESS(true), FAKEPOLL(true), MYLERZ(false), FAKEMANUAL(false)] });
      }
      if (path === orderPath) return ok({ order: order({ shipments }) });
      if (method === "POST" && path === `${orderPath}/shipments`) {
        if (body?.carrierCode === "jtexpress") {
          return apiError(
            409,
            "CARRIER_SANDBOX_NOT_ALLOWED",
            "The J&T Express sandbox only creates test shipments, and it is available to test stores only. Connect a production J&T Express account. Nothing was booked.",
            { carrierCode: "jtexpress" }
          );
        }
        return apiError(422, "CARRIER_PERMISSION_DENIED", "Refused.");
      }
      return undefined;
    },
  });
  const { page } = session;
  await page.goto(`${base}/orders/${ORDER}`);
  await settle(page);

  // Shipment rows
  const row = (tracking) => page.locator("li", { hasText: tracking });
  await checkLogo(row("zg-my-1"), "Mylerz", "mylerz", "Mylerz shipment row", "sm");
  await checkFallback(row("zg-fm-2"), "FakeManual", "FA", "FakeManual shipment row (no file)", "sm");
  check((await row("zg-hand-3").locator("[data-provider-logo]").count()) === 0, "manual shipment row has no logo");

  // Courier picker
  const option = (name) => page.locator("label", { has: page.getByRole("radio", { name }) });
  await checkLogo(option(/^Bosta/), "Bosta", "bosta", "picker: Bosta option", "sm");
  await checkLogo(option(/^J&T Express/), "J&T Express", "jtexpress", "picker: J&T option", "sm");
  await checkLogo(option(/^Mylerz/), "Mylerz", "mylerz", "picker: unconnected Mylerz option", "sm");
  await checkFallback(option(/^FakePoll/), "FakePoll", "FA", "picker: FakePoll option (no file)", "sm");
  const smBoxes = await allBoxes(page);
  check(
    smBoxes.length > 0 && smBoxes.every((s) => s === BOX.sm),
    `every order-page logo shares the ${BOX.sm} box (${smBoxes.join(", ")})`
  );
  check((await option(/^Manual/).locator("[data-provider-logo]").count()) === 0, "picker: Manual option has no logo");

  await page.getByRole("radio", { name: /^J&T Express/ }).check();
  await page.getByRole("button", { name: "Book with J&T Express" }).click();
  await settle(page);
  check(
    await page
      .getByText(
        "This J&T Express connection uses the J&T Express sandbox, which only creates test shipments, so nothing was booked. A production J&T Express account is required: connect one under Shipping."
      )
      .isVisible(),
    "409 CARRIER_SANDBOX_NOT_ALLOWED: sandbox only makes test shipments, production account required"
  );

  await page.getByRole("radio", { name: /^FakePoll/ }).check();
  await page.getByRole("button", { name: "Book with FakePoll" }).click();
  await settle(page);
  check(
    await page.getByText("FakePoll accepted the login, but it hasn't enabled API access for this account.", { exact: false }).isVisible(),
    "422 CARRIER_PERMISSION_DENIED on booking names the courier and asks it to enable API access"
  );

  await page.getByRole("radio", { name: /^Bosta/ }).check();
  await page.getByRole("button", { name: "Book with Bosta" }).click();
  await settle(page);
  check(
    await page.getByText("Bosta refused this action for the connected API key.", { exact: false }).isVisible(),
    "Bosta's permission error stays about the key's access level"
  );
  await assertClean(session, "K");
  return session;
}

export async function orderPaymentLogos(browser, base) {
  console.log("\nM. Order payments: gateway logo and name on each gateway attempt, fallback, none on COD");
  const session = await openPage(browser, base, {
    handler: (method, path) => {
      if (path === carriersPath) return ok({ configured: true, carriers: [] });
      if (path === orderPath) return ok({ order: order() });
      if (path === `${orderPath}/payment-timeline`) {
        return ok({
          timeline: paymentTimeline([
            payment("p-paymob", "paymob", { method: "card", maskedDisplay: "**** 4242" }),
            payment("p-kashier", "kashier", { method: "wallet", status: "captured" }),
            payment("p-fake", "fakegate", { method: "card" }),
            payment("p-cod", "cod", { method: null, mode: null, status: "initialized" }),
          ]),
        });
      }
      return undefined;
    },
  });
  const { page } = session;
  await page.goto(`${base}/orders/${ORDER}`);
  await settle(page);
  const attempt = (text) => page.locator("li", { hasText: text });
  await checkLogo(attempt("Card via Paymob"), "Paymob", "paymob", "Paymob attempt", "sm");
  await checkLogo(attempt("Wallet via Kashier"), "Kashier", "kashier", "Kashier attempt", "sm");
  await checkFallback(attempt("Card via fakegate"), "fakegate", "FA", "unknown gateway attempt (no file)", "sm");
  check((await attempt(/^cod ·/).locator("[data-provider-logo]").count()) === 0, "COD record has no logo");
  await assertClean(session, "M");
  return session;
}

// ---------------------------------------------------------------- payments page

export async function paymentsPageLogos(browser, base) {
  console.log("\nL. Payments page: gateway logos and fallback in light and dark; a .dark.png variant replaces the logo in dark only");
  const session = await openPage(browser, base, {
    handler: (method, path) => {
      if (path === `${paymentsPath}/gateways`) {
        return ok({ configured: true, onlineEnabled: true, gateways: [PAYMOB(true), KASHIER(false), FAKEGATE(false)] });
      }
      if (path === `${paymentsPath}/methods`) {
        return ok({
          onlineEnabled: true,
          methods: [{ id: "cod", provider: null, method: "cod", enabled: true, available: true, mode: null }],
        });
      }
      return undefined;
    },
  });
  const { page } = session;
  // Paymob gets a dark variant (bosta.png's file stands in); Kashier has none.
  const darkApplied = await injectDarkVariant(page, "paymob", "bosta");
  await page.goto(`${base}/payments`);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => localStorage.setItem("theme", value), theme);
    await page.reload();
    await settle(page);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    check(isDark === (theme === "dark"), `${theme} theme applied`);
    check(darkApplied(), `${theme}: dark variant registered for Paymob in this page`);
    const dark = theme === "dark";
    const paymob = await checkLogo(cardOf(page, "Paymob"), "Paymob", dark ? "bosta" : "paymob", `${theme}: Paymob card`);
    check(paymob?.variant === theme, `${theme}: Paymob shows its ${theme} variant (${paymob?.variant})`);
    const kashier = await checkLogo(cardOf(page, "Kashier"), "Kashier", "kashier", `${theme}: Kashier card`);
    check(kashier?.variant === "light", `${theme}: Kashier has no .dark.png, so its normal file shows (${kashier?.variant})`);
    await checkFallback(cardOf(page, "FakeGate"), "FakeGate", "FA", `${theme}: FakeGate card (no file)`);
    const other = await cardOf(page, "Paymob")
      .locator(`[data-provider-logo] img[data-variant="${dark ? "light" : "dark"}"]`)
      .evaluate((el) => getComputedStyle(el).display)
      .catch(() => null);
    check(other === "none", `${theme}: Paymob's other variant is not displayed (${other})`);
  }
  await assertClean(session, "L");
  return session;
}
