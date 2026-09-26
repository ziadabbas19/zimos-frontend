// Merchant dashboard: the generic carrier layer (courier connect cards,
// courier picker, multi-level address picker, manual-cancel acknowledgement,
// carrier error codes), driven in Chromium against a fully stubbed API.
//
//   npm run test:e2e                 all scenarios
//   npm run test:e2e -- B,C          only these scenarios
//   E2E_BASE_URL=http://localhost:5173 npm run test:e2e   reuse a running dashboard

import {
  BOSTA,
  FAKEMANUAL,
  FAKEPOLL,
  ME,
  MONA,
  ORDER,
  POLL_TREE,
  WS,
  apiError,
  manualCancelRequired,
  ok,
  order,
  shipment,
} from "./support/fixtures.mjs";
import {
  assertClean,
  bodiesOf,
  check,
  fail,
  launchBrowser,
  openPage,
  results,
  settle,
  startDashboard,
} from "./support/harness.mjs";

// Toasts and alerts wrap tracking numbers in bidi isolates (U+2066 … U+2069).
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);

const carriersPath = `/workspaces/${WS}/carriers`;
const orderPath = `/workspaces/${WS}/orders/${ORDER}`;

// ---------------------------------------------------------------- scenarios

async function bostaOnlyBooking(browser, base) {
  console.log("\nA. Bosta only connected: preselected, one-step booking, city/district unmatched keeps its payload");
  let posts = 0;
  const session = await openPage(browser, base, {
    handler: (method, path) => {
      if (path === carriersPath) return ok({ configured: true, carriers: [BOSTA(true)] });
      if (path === orderPath) return ok({ order: order() });
      if (method === "POST" && path === `${orderPath}/shipments`) {
        posts++;
        if (posts === 1) {
          return apiError(422, "CARRIER_ADDRESS_UNMATCHED", "no match", {
            carrierCode: "bosta",
            level: "district",
            orderAddress: { province: "Cairo", city: "Nasr 7" },
            matchedCity: { id: "CITY-CAI", name: "Cairo", nameAr: "القاهرة" },
            candidates: [
              { cityId: "CITY-CAI", cityName: "Cairo", cityNameAr: "القاهرة", districtId: "D-NASR", districtName: "Nasr City", districtNameAr: "مدينة نصر", zoneId: "Z1", zoneName: "Nasr", suggested: true },
              { cityId: "CITY-CAI", cityName: "Cairo", cityNameAr: "القاهرة", districtId: "D-MAADI", districtName: "Maadi", districtNameAr: "المعادي", zoneId: "Z2", zoneName: "Maadi", suggested: false },
            ],
          });
        }
        return ok({ shipment: shipment({ carrierCode: "bosta", waybillNumber: "BO-1" }) }, 201);
      }
      return undefined;
    },
  });
  const { page, requests } = session;
  await page.goto(`${base}/orders/${ORDER}`);
  await settle(page);
  check(await page.getByRole("radio", { name: /Bosta/ }).isChecked(), "Bosta radio preselected");
  check((await page.getByText("Choose how this order is shipped.").count()) === 0, "no 'choose how' prompt with one courier");
  await page.getByRole("button", { name: "Book with Bosta" }).click();
  await settle(page);
  check(
    await page.getByText("Matched Cairo, but not the area “Nasr 7”. Choose the district.").isVisible(),
    "Bosta district-level unmatched message"
  );
  await page.getByLabel("District / area").selectOption("D-NASR");
  await page.getByRole("button", { name: "Book with Bosta" }).click();
  await settle(page);
  const bodies = bodiesOf(requests, "POST", `/orders/${ORDER}/shipments`);
  check(
    bodies.length === 2 && bodies[0].carrierCode === "bosta" && !("carrierAddress" in bodies[0]),
    "first booking: carrierCode bosta, no carrierAddress"
  );
  check(
    JSON.stringify(bodies[1]?.carrierAddress) === JSON.stringify({ cityId: "CITY-CAI", districtId: "D-NASR" }),
    `retry sends {cityId, districtId} (got ${JSON.stringify(bodies[1]?.carrierAddress)})`
  );
  await assertClean(session, "A");
  return session;
}

async function severalCouriers(browser, base) {
  console.log("\nB. Several couriers: no default, multi-level unmatched → path, BOOKING_NOT_SAVED, reserved names");
  let posts = 0;
  const session = await openPage(browser, base, {
    handler: (method, path, body) => {
      if (path === carriersPath) return ok({ configured: true, carriers: [BOSTA(true), FAKEPOLL(true), FAKEMANUAL(false)] });
      if (path === `${carriersPath}/fakepoll/cities`) return ok({ levels: ["governorate", "city", "area"], cities: POLL_TREE });
      if (path === orderPath) return ok({ order: order() });
      if (method === "POST" && path === `${orderPath}/shipments`) {
        if (body?.carrierCode !== "fakepoll") {
          return ok({ shipment: shipment({ carrierCode: body.carrierCode, carrierResponse: null }) }, 201);
        }
        posts++;
        if (posts === 1) {
          return apiError(422, "CARRIER_ADDRESS_UNMATCHED", "no match", {
            carrierCode: "fakepoll",
            level: "area",
            levelIndex: 2,
            levels: ["governorate", "city", "area"],
            orderAddress: { province: "Cairo", city: "Nasr 7" },
            matchedCity: { id: "G-CAI", name: "Cairo", nameAr: "القاهرة" },
            matchedPath: [
              { id: "G-CAI", name: "Cairo", nameAr: "القاهرة" },
              { id: "C-NASR", name: "Nasr City", nameAr: "مدينة نصر" },
            ],
            candidates: [
              { id: "A-NASR-7", name: "Seventh District", nameAr: "الحي السابع", path: [], leaf: true, suggested: true },
              { id: "A-NASR-1", name: "First District", nameAr: "الحي الاول", path: [], leaf: true, suggested: false },
            ],
          });
        }
        return apiError(502, "CARRIER_BOOKING_NOT_SAVED", "FakePoll created shipment FP-99, but it could not be saved here.", {
          carrierCode: "fakepoll",
          trackingNumber: "FP-99",
          manualCancelRequired: true,
        });
      }
      return undefined;
    },
  });
  const { page, requests } = session;
  await page.goto(`${base}/orders/${ORDER}`);
  await settle(page);
  check(await page.getByText("Choose how this order is shipped.").isVisible(), "several connected: asks to choose, nothing preselected");
  check(!(await page.getByRole("radio", { name: /Bosta/ }).isChecked()), "Bosta not preselected");
  check(await page.getByRole("radio", { name: /FakeManual/ }).isDisabled(), "unconnected FakeManual option disabled");
  check(await page.getByText("Not connected. Connect it under Shipping to book from here.").isVisible(), "unconnected option explains why");
  check(await page.getByText("Booked in your FakePoll account, with status updates.").isVisible(), "no-label courier hint");

  await page.getByRole("radio", { name: /FakePoll/ }).check();
  await page.getByRole("button", { name: "Book with FakePoll" }).click();
  await settle(page);
  check(
    await page.getByText("Matched Cairo › Nasr City, but not the area “Nasr 7”. Choose it below.").isVisible(),
    "multi-level unmatched message names the matched path"
  );
  const gov = page.getByLabel("Governorate");
  const city = page.getByLabel(/^City/);
  const area = page.getByLabel("Area");
  check((await gov.isDisabled()) && (await gov.inputValue()) === "G-CAI", "matched governorate prefilled and fixed");
  check((await city.isDisabled()) && (await city.inputValue()) === "C-NASR", "matched city prefilled and fixed");
  const groups = await area.locator("optgroup").evaluateAll((els) => els.map((e) => e.label));
  check(groups.includes("Best matches"), `candidates grouped with best matches first (${groups.join(",")})`);
  check(await page.getByRole("button", { name: "Book with FakePoll" }).isDisabled(), "book disabled until the level is chosen");
  await area.selectOption("A-NASR-7");
  await page.getByRole("button", { name: "Book with FakePoll" }).click();
  await settle(page);
  const bodies = bodiesOf(requests, "POST", `/orders/${ORDER}/shipments`);
  check(
    JSON.stringify(bodies[1]?.carrierAddress) === JSON.stringify({ path: ["G-CAI", "C-NASR", "A-NASR-7"] }),
    `retry sends carrierAddress.path (got ${JSON.stringify(bodies[1]?.carrierAddress)})`
  );
  check(
    await page.getByText(new RegExp(`^Cancel ${LRI}FP-99${PDI} in your FakePoll dashboard$`)).isVisible(),
    "BOOKING_NOT_SAVED title with tracking number"
  );
  check(await page.getByText(/couldn't be saved here, and FakePoll can't cancel it from here/).isVisible(), "BOOKING_NOT_SAVED explanation");

  // Free picker: levels load one parent at a time, from one tree request.
  await page.getByRole("radio", { name: /Bosta/ }).check();
  await page.getByRole("radio", { name: /FakePoll/ }).check();
  await page.getByRole("button", { name: "Choose the delivery area myself" }).click();
  await settle(page);
  check(await page.getByLabel(/^City/).isDisabled(), "city waits for a governorate");
  await page.getByLabel("Governorate").selectOption("G-GIZ");
  await settle(page);
  await page.getByLabel(/^City/).selectOption("C-DOKKI");
  await settle(page);
  const areaOptions = await page.getByLabel("Area").locator("option").allTextContents();
  check(areaOptions.includes("Mesaha"), `area lists children of the chosen city (${areaOptions.join(",")})`);
  const treeFetches = requests.filter((r) => r.path.endsWith("/carriers/fakepoll/cities")).length;
  check(treeFetches === 1, `address tree fetched once for all levels (${treeFetches})`);

  // Manual form: which courier names are reserved.
  await page.getByRole("radio", { name: /^Manual/ }).check();
  const courierName = page.getByLabel("Courier name");
  const postsBefore = bodiesOf(requests, "POST", "/shipments").length;
  await courierName.fill("BOSTA");
  await page.getByRole("button", { name: "Add shipment" }).click();
  check(await page.getByText("Bosta is connected. Choose the Bosta option above").isVisible(), "Bosta refused as manual name");
  await courierName.fill("fake-poll");
  await page.getByRole("button", { name: "Add shipment" }).click();
  check(await page.getByText("FakePoll is connected. Choose the FakePoll option above").isVisible(), "connected FakePoll name refused");
  check(bodiesOf(requests, "POST", "/shipments").length === postsBefore, "no request for reserved names");
  await courierName.fill("FakeManual");
  await page.getByRole("button", { name: "Add shipment" }).click();
  await settle(page);
  const manualBodies = bodiesOf(requests, "POST", "/shipments");
  check(
    manualBodies.length === postsBefore + 1 && manualBodies.at(-1).carrierCode === "FakeManual",
    "unconnected courier's name is free for a manual shipment"
  );
  await assertClean(session, "B");
  return session;
}

async function manualCancelShipment(browser, base, locale) {
  console.log(`\nC. Manual-cancel courier: Cancel shipment → 409 → dialog → acknowledge (${locale})`);
  const session = await openPage(browser, base, {
    locale,
    handler: (method, path, body) => {
      if (path === carriersPath) return ok({ configured: true, carriers: [BOSTA(false), FAKEMANUAL(true)] });
      if (path === orderPath) return ok({ order: order({ shipments: [shipment()] }) });
      if (method === "PATCH" && path.includes("/shipments/")) {
        if (!body?.acknowledgeManualCancel) return manualCancelRequired("FM-0001");
        return ok({ shipment: shipment({ status: "cancelled", cancelMode: "manual_ack" }) });
      }
      return undefined;
    },
  });
  const { page, requests } = session;
  const L =
    locale === "ar"
      ? {
          cancel: "إلغاء الشحنة",
          title: "ألغِها من لوحة تحكم FakeManual أولًا",
          back: "رجوع",
          ack: /ألغيت هذه الشحنة من لوحة تحكم FakeManual/,
          confirm: "تأكيد ومتابعة",
          note: /لا يمكن إلغاء شحنات FakeManual من هنا/,
        }
      : {
          cancel: "Cancel shipment",
          title: "Cancel it in FakeManual's dashboard first",
          back: "Go back",
          ack: /I've cancelled this delivery in the FakeManual dashboard/,
          confirm: "Confirm and continue",
          note: /FakeManual can't cancel deliveries from here/,
        };
  await page.goto(`${base}/orders/${ORDER}`);
  await settle(page);
  check(await page.getByText(L.note).first().isVisible(), "created-shipment note explains the manual cancel");
  await page.getByRole("button", { name: L.cancel }).click();
  await settle(page);
  const dialog = page.getByRole("dialog", { name: L.title });
  check(await dialog.isVisible(), "dialog opens on 409");
  check(await dialog.getByText("FM-0001").isVisible(), "dialog lists the waybill");
  check(await dialog.getByText("FakeManual", { exact: true }).isVisible(), "dialog lists the courier");
  check(await dialog.getByRole("button", { name: L.confirm }).isDisabled(), "confirm disabled until acknowledged");
  await dialog.getByRole("button", { name: L.back }).click();
  await settle(page);
  check((await page.getByRole("dialog").count()) === 0, "Go back closes the dialog");
  check(bodiesOf(requests, "PATCH", "/shipments/").length === 1, "Go back sends nothing more");
  await page.getByRole("button", { name: L.cancel }).click();
  await settle(page);
  await page.getByRole("dialog").getByLabel(L.ack).check();
  await page.getByRole("dialog").getByRole("button", { name: L.confirm }).click();
  await settle(page);
  const patches = bodiesOf(requests, "PATCH", "/shipments/");
  // 1st click → 409, Go back; 2nd click → 409 again (a fresh, unacknowledged
  // request); confirm → the acknowledged repeat.
  check(
    patches.length === 3 &&
      !("acknowledgeManualCancel" in patches[1]) &&
      patches[2].acknowledgeManualCancel === true &&
      patches[2].status === "cancelled",
    `repeat carries acknowledgeManualCancel: true (${JSON.stringify(patches)})`
  );
  check(patches[0].acknowledgeManualCancel === undefined, "first attempt has no acknowledgement");
  check((await page.getByRole("dialog").count()) === 0, "dialog closes on success");
  await assertClean(session, "C");
  return session;
}

async function manualCancelOrder(browser, base) {
  console.log("\nD. Order cancel → 409 with two bookings → dialog → repeat with acknowledgement");
  const session = await openPage(browser, base, {
    handler: (method, path, body) => {
      if (path === carriersPath) return ok({ configured: true, carriers: [FAKEMANUAL(true)] });
      if (path === orderPath) return ok({ order: order({ shipments: [shipment()] }) });
      if (method === "POST" && path.endsWith("/cancel")) {
        if (!body?.acknowledgeManualCancel) return manualCancelRequired("FM-0001", "FM-0002");
        return ok({ order: order({ cancelledAt: "2026-09-26T10:00:00Z" }) });
      }
      return undefined;
    },
  });
  const { page, requests } = session;
  await page.goto(`${base}/orders/${ORDER}`);
  await settle(page);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByLabel("Reason").fill("Customer asked");
  await page.getByRole("button", { name: "Cancel this order" }).click();
  await settle(page);
  const dialog = page.getByRole("dialog", { name: "Cancel it in FakeManual's dashboard first" });
  check(await dialog.isVisible(), "manual-cancel dialog replaces the cancel dialog");
  check(await dialog.getByText("FM-0002").isVisible(), "both bookings listed");
  check(await dialog.getByText(/cancel these deliveries in your FakeManual dashboard/).isVisible(), "plural wording");
  await dialog.getByLabel(/I've cancelled these deliveries/).check();
  await dialog.getByRole("button", { name: "Confirm and continue" }).click();
  await settle(page);
  const cancels = bodiesOf(requests, "POST", "/cancel");
  check(
    cancels.length === 2 &&
      JSON.stringify(cancels[0]) === JSON.stringify({ reason: "Customer asked" }) &&
      JSON.stringify(cancels[1]) === JSON.stringify({ reason: "Customer asked", acknowledgeManualCancel: true }),
    `same request repeated with the acknowledgement (${JSON.stringify(cancels)})`
  );
  await assertClean(session, "D");
  return session;
}

async function flagAndHistory(browser, base) {
  console.log("\nE. carrier_cancel_unconfirmed flag, who acknowledged, last status check");
  const owner = await openPage(browser, base, {
    handler: (method, path) => {
      if (path === carriersPath) return ok({ configured: true, carriers: [FAKEMANUAL(true)] });
      if (path === `/workspaces/${WS}/members`) {
        return ok({
          members: [
            {
              id: "m1",
              workspaceId: WS,
              status: "active",
              user: { id: MONA, email: "mona@example.test", fullName: "Mona Ali", status: "active" },
              role: { id: "r1", key: "order_operator", name: "Order operator" },
            },
          ],
        });
      }
      if (path === orderPath) {
        return ok({
          order: order({
            riskFlags: ["carrier_cancel_unconfirmed"],
            shipments: [
              shipment({
                status: "cancelled",
                cancelMode: "manual_ack",
                cancelAcknowledgedBy: MONA,
                cancelAcknowledgedAt: "2026-09-25T12:00:00Z",
                lastPolledAt: "2026-09-26T09:30:00Z",
              }),
              shipment({
                id: "66666666-6666-4666-8666-666666666666",
                trackingCode: "zg000000002",
                waybillNumber: "FM-0002",
                status: "cancelled",
                cancelMode: "manual_ack",
                cancelAcknowledgedBy: ME,
                cancelAcknowledgedAt: "2026-09-25T13:00:00Z",
              }),
            ],
          }),
        });
      }
      return undefined;
    },
  });
  const { page } = owner;
  await page.goto(`${base}/orders/${ORDER}`);
  await settle(page);
  check(await page.getByText("FakeManual still shows a cancelled delivery as moving").isVisible(), "flag alert title");
  check(await page.getByText(/still reports the parcel as picked up, on its way or delivered/).isVisible(), "flag alert explanation");
  check(await page.getByText("Courier still shows a cancelled parcel moving").isVisible(), "flag label in risk flags");
  check(await page.getByText(/Confirmed by Mona Ali,/).isVisible(), "acknowledged by a teammate, by name");
  check(await page.getByText(/Confirmed by you,/).isVisible(), "acknowledged by me");
  check(await page.getByText(/Last checked with FakeManual/).isVisible(), "last status check shown");
  check((await page.getByRole("button", { name: "Cancel shipment" }).count()) === 0, "no cancel button on cancelled shipments");
  await assertClean(owner, "E");
  await owner.context.close();

  // An order operator can't read the team list: colleagues show as "a team
  // member", and /members is never asked for.
  const operator = await openPage(browser, base, {
    role: "order_operator",
    handler: (method, path) => {
      if (path === carriersPath) return ok({ configured: true, carriers: [FAKEMANUAL(true)] });
      if (path === orderPath) {
        return ok({
          order: order({
            shipments: [
              shipment({
                status: "cancelled",
                cancelMode: "manual_ack",
                cancelAcknowledgedBy: MONA,
                cancelAcknowledgedAt: "2026-09-25T12:00:00Z",
              }),
            ],
          }),
        });
      }
      return undefined;
    },
  });
  await operator.page.goto(`${base}/orders/${ORDER}`);
  await settle(operator.page);
  check(await operator.page.getByText(/Confirmed by a team member,/).isVisible(), "operator sees 'a team member'");
  check(!operator.requests.some((r) => r.path.endsWith("/members")), "operator makes no /members request");
  return operator;
}

async function shippingPage(browser, base) {
  console.log("\nF. Shipping page: cards from GET /carriers, generic connect form, CONNECT_CONFLICT");
  let lists = 0;
  const session = await openPage(browser, base, {
    handler: (method, path) => {
      if (method === "GET" && path === carriersPath) {
        lists++;
        // The conflicting request's connection shows up on the reload.
        return ok({ configured: true, carriers: [BOSTA(true), FAKEPOLL(false), FAKEMANUAL(lists > 1)] });
      }
      if (method === "PUT" && path === `${carriersPath}/fakepoll`) {
        return apiError(409, "CARRIER_CONNECT_CONFLICT", "FakePoll was connected by another request at the same time.");
      }
      return undefined;
    },
  });
  const { page, requests } = session;
  await page.goto(`${base}/shipping`);
  await settle(page);
  check(await page.getByText("Pickup: Bosta account default · Package: Parcel · Label: A6, English").isVisible(), "Bosta summary unchanged");
  check(await page.getByRole("button", { name: "Edit pickup and labels" }).isVisible(), "Bosta keeps its edit button copy");
  check(await page.getByRole("heading", { name: "FakePoll" }).isVisible(), "FakePoll card from the list");
  await page.getByRole("button", { name: "Connect FakePoll" }).click();
  const token = page.getByLabel("API token");
  const account = page.getByLabel("Account ID");
  check((await token.getAttribute("type")) === "password", "secret field masked");
  check((await account.getAttribute("type")) === "text", "non-secret field plain");
  check((await page.getByText("Use a key with Full Access").count()) === 0, "no Bosta-only notice on FakePoll");
  check(
    await page.getByText("Find it in FakePoll's dashboard. We store it encrypted and never show it again.").isVisible(),
    "generic key hint"
  );
  const verify = page.getByRole("button", { name: "Check key and continue" });
  await token.fill("abc");
  check(await verify.isDisabled(), "needs every credential field");
  await account.fill("A-1");
  await verify.click();
  await settle(page);
  const puts = bodiesOf(requests, "PUT", "/carriers/fakepoll");
  check(
    JSON.stringify(puts[0]) === JSON.stringify({ credentials: { token: "abc", accountId: "A-1" } }),
    `credentials from the field list (${JSON.stringify(puts[0])})`
  );
  check(await page.getByText(/FakePoll was connected from another tab or by a teammate at the same moment/).isVisible(), "conflict message");
  check(lists >= 2, `list reloaded after the conflict (${lists})`);
  check(await page.getByText("FakeManual can't cancel deliveries from here.", { exact: false }).isVisible(), "manual-cancel note on a connected FakeManual");
  check(
    (await page.getByText("FakeManual doesn't send status updates. Press Sync on a shipment to pull its latest status.").count()) === 0,
    "polling courier doesn't claim 'no updates'"
  );
  check(await page.getByText("We check FakeManual for status updates regularly.", { exact: false }).isVisible(), "polling note");
  await assertClean(session, "F");
  return session;
}

async function correction(browser, base) {
  console.log("\nG. Confirmation correction to rejected → 409 → dialog → acknowledged");
  const taskOrder = order();
  for (const key of ["stage", "payments", "shipments", "confirmationTask"]) delete taskOrder[key];
  const task = {
    id: "77777777-7777-4777-8777-777777777777",
    workspaceId: WS,
    orderId: ORDER,
    status: "done",
    lockedByUserId: null,
    lockedAt: null,
    lockedBy: null,
    lockExpiresAt: null,
    attemptCount: 1,
    nextRetryAt: null,
    outcome: "confirmed",
    rejectionReason: null,
    completedAt: "2026-09-25T10:00:00Z",
    createdAt: "2026-09-25T09:00:00Z",
    updatedAt: "2026-09-25T10:00:00Z",
    attempts: [],
    correctable: true,
    order: taskOrder,
  };
  const tasksPath = `/workspaces/${WS}/confirmation-tasks`;
  const session = await openPage(browser, base, {
    handler: (method, path, body) => {
      if (path === `${tasksPath}/counts`) {
        return ok({ counts: { pending: 0, pendingDue: 0, inProgress: 0, inProgressMine: 0, done: 1 } });
      }
      if (method === "GET" && path.startsWith(`${tasksPath}?`)) {
        return ok({ tasks: path.includes("status=done") ? [task] : [], nextCursor: null });
      }
      if (method === "POST" && path.endsWith("/correction")) {
        if (!body?.acknowledgeManualCancel) return manualCancelRequired("FM-0001");
        return ok({ task: { ...task, outcome: "rejected", order: { ...task.order, confirmationState: "rejected" } } });
      }
      return undefined;
    },
  });
  const { page, requests } = session;
  await page.goto(`${base}/confirmation-queue`);
  await settle(page);
  // FilterTabs are toggle buttons (aria-pressed), not ARIA tabs.
  await page.getByRole("button", { name: /^Done/ }).click();
  await settle(page);
  await page.getByRole("button", { name: "Correct outcome" }).click();
  await page.getByLabel(/Reason/).fill("Customer called back");
  await page.getByRole("dialog").getByRole("button", { name: /Rejected|reject/i }).click();
  await settle(page);
  const dialog = page.getByRole("dialog", { name: "Cancel it in FakeManual's dashboard first" });
  check(await dialog.isVisible(), "manual-cancel dialog over the correction");
  check((await page.getByRole("dialog").count()) === 1, "correction modal hidden meanwhile");
  await dialog.getByRole("button", { name: "Go back" }).click();
  check((await page.getByLabel(/Reason/).inputValue()) === "Customer called back", "Go back returns to the correction with the reason kept");
  await page.getByRole("dialog").getByRole("button", { name: /Rejected|reject/i }).click();
  await settle(page);
  await page.getByRole("dialog").getByLabel(/I've cancelled this delivery/).check();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm and continue" }).click();
  await settle(page);
  const posts = bodiesOf(requests, "POST", "/correction");
  check(
    posts.length === 3 &&
      posts[2].acknowledgeManualCancel === true &&
      posts[2].outcome === "rejected" &&
      posts[2].reason === "Customer called back",
    `correction repeated with acknowledgement (${JSON.stringify(posts)})`
  );
  check(!("acknowledgeManualCancel" in posts[0]), "first correction without acknowledgement");
  await assertClean(session, "G");
  return session;
}

// ---------------------------------------------------------------- run

const SCENARIOS = {
  A: bostaOnlyBooking,
  B: severalCouriers,
  C: (browser, base) => manualCancelShipment(browser, base, "en"),
  C2: (browser, base) => manualCancelShipment(browser, base, "ar"),
  D: manualCancelOrder,
  E: flagAndHistory,
  F: shippingPage,
  G: correction,
};

const only = process.argv[2]?.split(",").filter(Boolean);
const dashboard = await startDashboard();
const browser = await launchBrowser();
const offOrigin = new Set();
try {
  console.log(`Dashboard: ${dashboard.baseUrl} (API fully stubbed, off-origin requests blocked)`);
  for (const [key, run] of Object.entries(SCENARIOS)) {
    if (only && !only.includes(key)) continue;
    let session;
    try {
      session = await run(browser, dashboard.baseUrl);
    } catch (err) {
      fail(`${key} threw: ${String(err.message).split("\n")[0]}`);
    } finally {
      for (const url of session?.blocked ?? []) offOrigin.add(url);
      await session?.context.close().catch(() => {});
    }
  }
} finally {
  await browser.close();
  await dashboard.stop();
}

if (offOrigin.size > 0) console.log(`\nBlocked ${offOrigin.size} off-origin request(s):\n  ${[...offOrigin].join("\n  ")}`);
const { passes, failures } = results();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
