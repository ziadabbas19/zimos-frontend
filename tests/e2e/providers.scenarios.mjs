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

/** A real logo: an <img> with this alt that loaded, kept in proportion inside its tile. */
async function checkLogo(scope, name, file, label) {
  const img = scope.getByRole("img", { name, exact: true }).first();
  const info = await img
    .evaluate((el) => ({
      tag: el.tagName,
      src: el.getAttribute("src") || "",
      loaded: el.complete && el.naturalWidth > 0,
      fit: getComputedStyle(el).objectFit,
      tileBg: getComputedStyle(el.parentElement).backgroundColor,
    }))
    .catch(() => null);
  check(info?.tag === "IMG", `${label}: <img alt="${name}">`);
  check(Boolean(info?.src.includes(file)), `${label}: served from ${file} (${info?.src})`);
  check(Boolean(info?.loaded), `${label}: image loaded`);
  check(info?.fit === "contain", `${label}: aspect ratio kept (object-fit ${info?.fit})`);
  return info;
}

/** The no-file fallback: a role="img" badge named `name`, showing `initials`, and no <img>. */
async function checkFallback(scope, name, initials, label) {
  const badge = scope.getByRole("img", { name, exact: true }).first();
  const info = await badge
    .evaluate((el) => ({ tag: el.tagName, text: el.textContent.trim(), fallback: el.hasAttribute("data-fallback") }))
    .catch(() => null);
  check(info?.tag === "SPAN" && info.fallback, `${label}: initials badge, not an image`);
  check(info?.text === initials, `${label}: initials "${initials}" (got "${info?.text}")`);
}

// ---------------------------------------------------------------- shipping page

export async function shippingLogosAndSandbox(browser, base) {
  console.log("\nH. Shipping page: courier logos, J&T file-name match, fallback, Sandbox badge from the server");
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
  await checkLogo(cardOf(page, "J&T Express"), "J&T Express", "JT-Express", "J&T card (JT-Express.png ↔ jtexpress)");
  await checkLogo(cardOf(page, "Mylerz"), "Mylerz", "mylerz", "Mylerz card");
  await checkFallback(cardOf(page, "FakePoll"), "FakePoll", "FA", "FakePoll card (no file)");

  const sizes = await page.locator("[data-provider-logo]").evaluateAll((els) =>
    els.map((el) => `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
  );
  check(sizes.length === 4 && new Set(sizes).size === 1, `every card logo tile is the same size (${sizes.join(", ")})`);

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
  await checkLogo(row("zg-my-1"), "Mylerz", "mylerz", "Mylerz shipment row");
  await checkFallback(row("zg-fm-2"), "FakeManual", "FA", "FakeManual shipment row (no file)");
  check((await row("zg-hand-3").locator("[data-provider-logo]").count()) === 0, "manual shipment row has no logo");

  // Courier picker
  const option = (name) => page.locator("label", { has: page.getByRole("radio", { name }) });
  await checkLogo(option(/^Bosta/), "Bosta", "bosta", "picker: Bosta option");
  await checkLogo(option(/^J&T Express/), "J&T Express", "JT-Express", "picker: J&T option");
  await checkLogo(option(/^Mylerz/), "Mylerz", "mylerz", "picker: unconnected Mylerz option");
  await checkFallback(option(/^FakePoll/), "FakePoll", "FA", "picker: FakePoll option (no file)");
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
  await checkLogo(attempt("Card via Paymob"), "Paymob", "paymob", "Paymob attempt");
  await checkLogo(attempt("Wallet via Kashier"), "Kashier", "kashier", "Kashier attempt");
  await checkFallback(attempt("Card via fakegate"), "fakegate", "FA", "unknown gateway attempt (no file)");
  check((await attempt(/^cod ·/).locator("[data-provider-logo]").count()) === 0, "COD record has no logo");
  await assertClean(session, "M");
  return session;
}

// ---------------------------------------------------------------- payments page

export async function paymentsPageLogos(browser, base) {
  console.log("\nL. Payments page: gateway logos and fallback, in light and dark themes");
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
  await page.goto(`${base}/payments`);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => localStorage.setItem("theme", value), theme);
    await page.reload();
    await settle(page);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    check(isDark === (theme === "dark"), `${theme} theme applied`);
    const paymob = await checkLogo(cardOf(page, "Paymob"), "Paymob", "paymob", `${theme}: Paymob card`);
    await checkLogo(cardOf(page, "Kashier"), "Kashier", "kashier", `${theme}: Kashier card`);
    await checkFallback(cardOf(page, "FakeGate"), "FakeGate", "FA", `${theme}: FakeGate card (no file)`);
    check(paymob?.tileBg === "rgb(255, 255, 255)", `${theme}: logo sits on a light tile (${paymob?.tileBg})`);
  }
  await assertClean(session, "L");
  return session;
}
