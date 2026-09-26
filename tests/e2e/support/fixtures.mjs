// Stub data for the dashboard's carrier screens. The shapes mirror the
// backend's responses (Backend src/modules/shipping), and the two fake
// couriers mirror the backend's own test adapters (tests/helpers/fakeCarriers.js):
//
//   fakepoll    three address levels (governorate > city > area), cancel via
//               API, no label, account-level webhook, polled
//   fakemanual  two levels (zone > area), NO cancel API (manual cancel +
//               acknowledgement), no webhook, polled

export const WS = "11111111-1111-4111-8111-111111111111";
export const ORDER = "22222222-2222-4222-8222-222222222222";
export const ME = "33333333-3333-4333-8333-333333333333";
export const MONA = "44444444-4444-4444-8444-444444444444";

export const ok = (body, status = 200) => ({ status, body });
export const apiError = (status, code, message, details) => ({
  status,
  body: { error: { code, message, details, requestId: "req-e2e" } },
});

const connection = (code, settings = {}) => ({
  status: "active",
  settings,
  lastVerifiedAt: "2026-09-20T10:00:00Z",
  connectedAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-20T10:00:00Z",
  webhookUrl: `https://api.example.test/api/v1/webhooks/carriers/${code}/token`,
});

export const BOSTA = (connected) => ({
  code: "bosta",
  name: "Bosta",
  webhookSetup: "per_shipment",
  supportsLabel: true,
  credentialFields: [{ key: "apiKey", label: "API key", secret: true }],
  settingFields: [
    { key: "businessLocationId", label: "Pickup location" },
    { key: "packageType", label: "Package type", options: ["Parcel", "Document", "Light Bulky", "Heavy Bulky"] },
    {
      key: "tierMap",
      label: "Package per weight tier",
      kind: "tier_map",
      packageTypes: ["Parcel", "Document", "Light Bulky", "Heavy Bulky"],
      parcelSizes: ["SMALL", "MEDIUM", "LARGE"],
    },
    { key: "awbType", label: "Label size", options: ["A4", "A6"] },
    { key: "awbLang", label: "Label language", options: ["ar", "en"] },
  ],
  capabilities: { cancel: "api", label: true, webhook: "per_shipment", polling: false, addressLevels: ["city", "district"] },
  connection: connected ? connection("bosta", { packageType: "Parcel", awbType: "A6", awbLang: "en" }) : null,
});

export const FAKEPOLL = (connected) => ({
  code: "fakepoll",
  name: "FakePoll",
  webhookSetup: "account",
  supportsLabel: false,
  credentialFields: [
    { key: "token", label: "API token", secret: true },
    { key: "accountId", label: "Account ID" },
  ],
  settingFields: [{ key: "serviceLevel", label: "Service level", options: ["standard", "express"] }],
  capabilities: {
    cancel: "api",
    label: false,
    webhook: "account",
    polling: true,
    addressLevels: ["governorate", "city", "area"],
  },
  connection: connected ? connection("fakepoll") : null,
});

export const FAKEMANUAL = (connected) => ({
  code: "fakemanual",
  name: "FakeManual",
  webhookSetup: "none",
  supportsLabel: false,
  credentialFields: [{ key: "token", label: "API token", secret: true }],
  settingFields: [],
  capabilities: { cancel: "manual", label: false, webhook: "none", polling: true, addressLevels: ["zone", "area"] },
  connection: connected ? connection("fakemanual") : null,
});

/** fakepoll's tree, as GET /carriers/fakepoll/cities returns it under `cities`. */
export const POLL_TREE = [
  {
    id: "G-CAI",
    name: "Cairo",
    nameAr: "القاهرة",
    children: [
      {
        id: "C-NASR",
        name: "Nasr City",
        nameAr: "مدينة نصر",
        children: [
          { id: "A-NASR-1", name: "First District", nameAr: "الحي الاول" },
          { id: "A-NASR-7", name: "Seventh District", nameAr: "الحي السابع" },
        ],
      },
      {
        id: "C-NEWCAI",
        name: "New Cairo",
        nameAr: "القاهرة الجديدة",
        children: [{ id: "A-REHAB", name: "Rehab", nameAr: "الرحاب" }],
      },
    ],
  },
  {
    id: "G-GIZ",
    name: "Giza",
    nameAr: "الجيزة",
    children: [
      {
        id: "C-DOKKI",
        name: "Dokki",
        nameAr: "الدقي",
        children: [{ id: "A-DOKKI-1", name: "Mesaha", nameAr: "المساحة" }],
      },
    ],
  },
];

/** A confirmed, unshipped COD order (GET /orders/:id shape). */
export function order(extra = {}) {
  return {
    id: ORDER,
    workspaceId: WS,
    websiteId: null,
    funnelId: null,
    customerId: "c1",
    orderNumber: "ZG-1001",
    confirmationState: "confirmed",
    financialState: "pending",
    fulfillmentState: "unfulfilled",
    paymentMethod: "cod",
    currency: "EGP",
    subtotalAmount: "50000",
    discountAmount: "0",
    shippingAmount: "0",
    taxAmount: "0",
    totalAmount: "50000",
    amountPaid: "0",
    amountRefunded: "0",
    contactSnapshot: { fullName: "Sara", phone: "01000000000" },
    shippingAddressSnapshot: { country: "EG", province: "Cairo", city: "Nasr 7", addressLine: "12 St" },
    discountsSnapshot: [],
    notes: null,
    riskFlags: [],
    cancelledAt: null,
    cancellationReason: null,
    linkedFromOrderId: null,
    createdAt: "2026-09-25T10:00:00Z",
    updatedAt: "2026-09-25T10:00:00Z",
    items: [],
    stage: "ready_to_ship",
    payments: [],
    refunds: [],
    shipments: [],
    confirmationTask: null,
    ...extra,
  };
}

/** A shipment booked with fakemanual (courier-booked: waybill + carrierShipmentId). */
export function shipment(extra = {}) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    orderId: ORDER,
    workspaceId: WS,
    trackingCode: "zg000000001",
    carrierCode: "fakemanual",
    waybillNumber: "FM-0001",
    status: "created",
    trackingUrl: null,
    carrierResponse: { carrierShipmentId: "fm-1", address: { path: ["Z-CAI", "AR-NASR"] } },
    shippedAt: null,
    deliveredAt: null,
    carrierAccountId: "acc-1",
    cancelMode: null,
    cancelAcknowledgedBy: null,
    cancelAcknowledgedAt: null,
    nextPollAt: null,
    lastPolledAt: null,
    pollFailures: 0,
    createdAt: "2026-09-25T11:00:00Z",
    updatedAt: "2026-09-25T11:00:00Z",
    ...extra,
  };
}

/** A body of 409 CARRIER_MANUAL_CANCEL_REQUIRED for the given waybills. */
export function manualCancelRequired(...waybills) {
  return apiError(409, "CARRIER_MANUAL_CANCEL_REQUIRED", "FakeManual can't be cancelled from here.", {
    shipments: waybills.map((waybillNumber, i) => ({
      shipmentId: `s${i + 1}`,
      carrierCode: "fakemanual",
      carrierName: "FakeManual",
      waybillNumber,
    })),
  });
}

// ---------------------------------------------------------------- providers
//
// Real carrier and gateway codes (Backend carriers/jtexpress.js, mylerz.js,
// payments/gateways/paymob.js, kashier.js), so the dashboard's logo lookup is
// exercised against the files in src/assets/providers. "fakegate" has no file.

/** J&T: the only courier with an `environment` credential (production | sandbox). */
export const JTEXPRESS = (connected, extra = {}) => ({
  code: "jtexpress",
  name: "J&T Express",
  webhookSetup: "none",
  supportsLabel: true,
  credentialFields: [
    { key: "apiAccount", label: "API account", secret: false },
    { key: "privateKey", label: "Private key", secret: true },
    { key: "customerCode", label: "Customer code", secret: false },
    { key: "password", label: "Customer password", secret: true },
    { key: "environment", label: "Environment", secret: false, options: ["production", "sandbox"] },
  ],
  settingFields: [],
  capabilities: { cancel: "api", label: true, webhook: "none", polling: true, addressLevels: ["governorate", "city", "area"] },
  connection: connected ? { ...connection("jtexpress"), ...extra } : null,
});

export const MYLERZ = (connected) => ({
  code: "mylerz",
  name: "Mylerz",
  webhookSetup: "none",
  supportsLabel: true,
  credentialFields: [
    { key: "username", label: "Username", secret: false },
    { key: "password", label: "Password", secret: true },
  ],
  settingFields: [],
  capabilities: { cancel: "api", label: true, webhook: "none", polling: true, addressLevels: ["city", "neighborhood"] },
  connection: connected ? connection("mylerz") : null,
});

const gatewayConnection = (code, mode = "live") => ({
  status: "active",
  mode,
  settings: {},
  methods: ["card"],
  webhookUrl: `https://api.example.test/api/v1/webhooks/payments/${code}/token`,
  lastVerifiedAt: "2026-09-20T10:00:00Z",
  lastWebhookAt: null,
  connectedAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-20T10:00:00Z",
});

const gateway = (code, name, connected) => ({
  code,
  name,
  methods: ["card", "wallet"],
  currencies: ["EGP"],
  credentialFields: [{ key: "apiKey", label: { en: "API key", ar: "مفتاح API" }, secret: true }],
  settingFields: [],
  setupSteps: { en: [], ar: [] },
  helpLinks: [],
  webhookSetup: { field: "Webhook URL", perIntegration: false, automatic: true },
  methodsFromAccount: true,
  connection: connected ? gatewayConnection(code) : null,
});

export const PAYMOB = (connected) => gateway("paymob", "Paymob", connected);
export const KASHIER = (connected) => gateway("kashier", "Kashier", connected);
/** A gateway with no logo file: the initials badge. */
export const FAKEGATE = (connected) => gateway("fakegate", "FakeGate", connected);

/** One payment attempt / record (GET .../payment-timeline `attempts[]`). */
export function payment(id, providerCode, extra = {}) {
  return {
    id,
    orderId: ORDER,
    workspaceId: WS,
    providerCode,
    status: "failed",
    amount: "50000",
    currency: "EGP",
    providerReference: null,
    maskedDisplay: null,
    failureReason: null,
    method: null,
    mode: "live",
    createdAt: "2026-09-25T10:00:00Z",
    updatedAt: "2026-09-25T10:00:00Z",
    ...extra,
  };
}

export function paymentTimeline(attempts) {
  return {
    orderId: ORDER,
    currency: "EGP",
    totalAmount: 50000,
    amountPaid: 0,
    amountRefunded: 0,
    pendingRefunds: 0,
    refundable: 0,
    refundVia: "gateway",
    perPayment: [],
    alerts: [],
    paymentExpiresAt: null,
    attempts,
    events: [],
    refunds: [],
  };
}
