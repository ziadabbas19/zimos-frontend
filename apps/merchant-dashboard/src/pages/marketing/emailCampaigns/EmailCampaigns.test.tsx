import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { EmailCampaign, EmailCampaignOverview } from "@store-builder/api-client";
import { callsTo, fakeBackend, type FakeCall } from "@/test/fakeBackend";
import { renderWithProviders, currentPath } from "@/test/renderWithProviders";
import { EMAIL_CAMPAIGNS_ENABLED } from "@/lib/features";
import app from "../../../App.tsx?raw";
import { EmailCampaignsPage } from "./EmailCampaignsPage";
import { EmailCampaignEditorPage } from "./EmailCampaignEditorPage";
import { blankForm, formOf, payloadOf, validate, emptyBlock } from "./campaignForm";

const BASE = "/workspaces/ws_1/email-campaigns";
const PLAN_OPEN = { "GET /plan-features": { planFeatures: { features: [], enforced: false } } };

const OVERVIEW: EmailCampaignOverview = {
  quota: {
    monthly: { max: 1000, used: 250, remaining: 750, resetsAt: "2026-12-01T00:00:00.000Z" },
    daily: { cap: 1000, used: 40, remaining: 960, resetsAt: "2026-11-14T00:00:00.000Z" },
  },
  sender: { fromName: "Nour Store", fromAddress: "no-reply@zimos.co", replyTo: "hello@nour.example" },
  provider: { ready: true, reportsDelivery: true, reportsEngagement: true },
  locale: "en",
  audiences: { segments: [{ id: "seg1", name: "Big spenders" }], rfm: false },
};

const STATS = { recipients: 0, sent: 0, failed: 0, skipped: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 };

function campaign(over: Partial<EmailCampaign> = {}): EmailCampaign {
  return {
    id: "c1",
    name: "November sale",
    subject: "20% off this week",
    preheader: null,
    blocks: [
      { type: "heading", text: "Summer sale" },
      { type: "button", label: "Shop now", url: "https://nour.example/sale" },
    ],
    locale: "en",
    replyTo: "hello@nour.example",
    audience: { type: "all" },
    status: "draft",
    scheduledAt: null,
    startedAt: null,
    finishedAt: null,
    cancelledAt: null,
    pausedUntil: null,
    failureReason: null,
    stats: STATS,
    createdAt: "2026-11-13T08:00:00.000Z",
    updatedAt: "2026-11-13T08:00:00.000Z",
    ...over,
  };
}

const PREVIEW = { preview: { subject: "20% off this week", html: "<!doctype html><html><body><h1>Summer sale</h1></body></html>", text: "Summer sale" } };

describe("the campaigns list", () => {
  it("shows the plan notice when the plan lacks email campaigns", async () => {
    fakeBackend({ "GET /plan-features": { planFeatures: { features: [], enforced: true, growthEnforced: true } } });
    renderWithProviders(<EmailCampaignsPage />, { route: "/marketing/email-campaigns" });
    expect(await screen.findByText("Your plan doesn't include Email campaigns. Upgrade your plan to use it.")).toBeInTheDocument();
  });

  it("says there are none yet, with the month's quota as a meter", async () => {
    fakeBackend({ ...PLAN_OPEN, [`GET ${BASE}/overview`]: OVERVIEW, [`GET ${BASE}`]: { campaigns: [], nextCursor: null } });
    renderWithProviders(<EmailCampaignsPage />, { route: "/marketing/email-campaigns" });
    expect(await screen.findByText("No campaigns yet")).toBeInTheDocument();
    const meter = await screen.findByRole("meter", { name: "This month's emails" });
    expect(meter).toHaveAttribute("aria-valuenow", "250");
    expect(meter).toHaveAttribute("aria-valuemax", "1000");
    expect(screen.getByText("250 of 1,000 used")).toBeInTheDocument();
  });

  it("lists campaigns with their status and numbers, opens and clicks when the provider reports them", async () => {
    const sent = campaign({ id: "c2", name: "October sale", status: "sent", stats: { ...STATS, recipients: 120, sent: 118, delivered: 110, opened: 60, clicked: 12, failed: 2, unsubscribed: 3 } });
    fakeBackend({ ...PLAN_OPEN, [`GET ${BASE}/overview`]: OVERVIEW, [`GET ${BASE}`]: { campaigns: [campaign(), sent], nextCursor: null } });
    renderWithProviders(<EmailCampaignsPage />, { route: "/marketing/email-campaigns" });
    expect(await screen.findByRole("link", { name: "October sale" })).toHaveAttribute("href", "/marketing/email-campaigns/c2");
    expect(screen.getAllByText("Opened").length).toBeGreaterThan(0);
    const table = screen.getByRole("table");
    // The column header and the sent campaign's badge.
    expect(within(table).getAllByText("Sent")).toHaveLength(2);
    expect(within(table).getByText("Draft")).toBeInTheDocument();
    expect(within(table).getByText("60")).toBeInTheDocument();
  });

  it("reads right to left in Arabic", async () => {
    fakeBackend({ ...PLAN_OPEN, [`GET ${BASE}/overview`]: OVERVIEW, [`GET ${BASE}`]: { campaigns: [campaign()], nextCursor: null } });
    renderWithProviders(<EmailCampaignsPage />, { route: "/marketing/email-campaigns", locale: "ar" });
    expect(await screen.findByRole("heading", { name: "حملات البريد" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(within(await screen.findByRole("table")).getByText("مسودة")).toBeInTheDocument();
  });
});

describe("the campaign editor", () => {
  function backend(extra: Record<string, unknown> = {}) {
    let saved = campaign();
    return fakeBackend({
      ...PLAN_OPEN,
      [`GET ${BASE}/overview`]: OVERVIEW,
      [`POST ${BASE}/audience`]: (call: FakeCall) => ({ count: (call.body as { audience: { type: string } }).audience.type === "rules" ? 12 : 300, subscribed: 300 }),
      [`POST ${BASE}/preview`]: PREVIEW,
      [`POST ${BASE}/test`]: { sent: true, to: "agent@zimos.test" },
      [`POST ${BASE}`]: (call: FakeCall) => {
        saved = campaign({ ...(call.body as object) } as Partial<EmailCampaign>);
        return { campaign: saved };
      },
      [`PATCH ${BASE}/c1`]: (call: FakeCall) => {
        saved = { ...saved, ...(call.body as object) };
        return { campaign: saved };
      },
      [`GET ${BASE}/c1`]: () => ({ campaign: saved }),
      [`POST ${BASE}/c1/send`]: () => ({ campaign: { ...saved, status: "sending", stats: { ...STATS, recipients: 300 } } }),
      [`GET ${BASE}/c1/recipients`]: { recipients: [], nextCursor: null },
      ...extra,
    });
  }

  it("walks a new campaign through audience, content and review, and sends it", async () => {
    const calls = backend();
    renderWithProviders(<EmailCampaignEditorPage />, { route: "/marketing/email-campaigns/new", path: "/marketing/email-campaigns/:campaignId" });
    expect(await screen.findByRole("heading", { name: "New email campaign" })).toBeInTheDocument();
    expect(await screen.findByText("300 of 300 subscribed customers")).toBeInTheDocument();

    // By orders and spend: the count follows the rule.
    fireEvent.click(screen.getByRole("radio", { name: /By orders and spend/ }));
    fireEvent.change(screen.getByLabelText("At least … orders"), { target: { value: "2" } });
    expect(await screen.findByText("12 of 300 subscribed customers")).toBeInTheDocument();
    const counted = callsTo(calls, "POST", "/email-campaigns/audience").at(-1)!;
    expect(counted.body).toEqual({ audience: { type: "rules", rules: { minOrders: 2 } } });

    fireEvent.change(screen.getByLabelText(/Campaign name/), { target: { value: "November sale" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: /Content/ })).toHaveAttribute("aria-current", "step");

    fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: "20% off this week" } });
    // The three starting blocks: a heading, a text, a button. A bad link is said beside its field.
    fireEvent.change(screen.getByLabelText(/Heading text/), { target: { value: "Summer sale" } });
    fireEvent.change(screen.getByRole("textbox", { name: /^Text/ }), { target: { value: "Everything is 20% off." } });
    fireEvent.change(screen.getByLabelText(/Button text/), { target: { value: "Shop now" } });
    fireEvent.change(screen.getByLabelText(/^Opens/), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Use a link starting with https://")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/email-campaigns")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/^Opens/), { target: { value: "https://nour.example/sale" } });

    // The preview is the server's HTML in a sandboxed frame.
    const frame = await screen.findByTitle("Email preview");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame.getAttribute("srcdoc")).toContain("Summer sale");
    fireEvent.click(screen.getByRole("radio", { name: "Phone" }));

    fireEvent.click(screen.getByRole("button", { name: "Send a test to myself" }));
    expect(await screen.findByText("A test went to agent@zimos.test.")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/email-campaigns/test")[0].body).toEqual(
      expect.objectContaining({ subject: "20% off this week", locale: "en", replyTo: "hello@nour.example" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText('"Nour Store" <no-reply@zimos.co>')).toBeInTheDocument();
    expect(screen.getByText("12 of the 750 emails left this month")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send now" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Send this campaign to 12 customers now?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Send now" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/email-campaigns/c1/send")).toHaveLength(1));
    const created = callsTo(calls, "POST", "/email-campaigns")[0].body;
    expect(created).toEqual({
      name: "November sale",
      subject: "20% off this week",
      preheader: null,
      locale: "en",
      replyTo: "hello@nour.example",
      audience: { type: "rules", rules: { minOrders: 2 } },
      blocks: [
        { type: "heading", text: "Summer sale" },
        { type: "text", text: "Everything is 20% off." },
        { type: "button", label: "Shop now", url: "https://nour.example/sale" },
      ],
    });
    // Sending: the page becomes the campaign's results.
    expect(await screen.findByRole("heading", { name: "Results" })).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe("/marketing/email-campaigns/c1"));
  });

  it("won't send what the month's quota doesn't cover", async () => {
    backend({ [`GET ${BASE}/overview`]: { ...OVERVIEW, quota: { ...OVERVIEW.quota, monthly: { ...OVERVIEW.quota.monthly, remaining: 100 } } } });
    renderWithProviders(<EmailCampaignEditorPage />, { route: "/marketing/email-campaigns/c1", path: "/marketing/email-campaigns/:campaignId" });
    fireEvent.click(await screen.findByRole("button", { name: /Review and send/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This campaign needs 300 emails and your plan has 100 left this month.");
    expect(screen.getByRole("button", { name: "Send now" })).toBeDisabled();
  });

  it("adds, moves and removes blocks with buttons, the keyboard way", async () => {
    backend();
    renderWithProviders(<EmailCampaignEditorPage />, { route: "/marketing/email-campaigns/c1", path: "/marketing/email-campaigns/:campaignId" });
    fireEvent.click(await screen.findByRole("button", { name: /Content/ }));
    const list = () => screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-label")?.match(/^(Heading|Button|Divider) \d$/));
    expect(list().map((li) => li.getAttribute("aria-label"))).toEqual(["Heading 1", "Button 1"]);
    fireEvent.click(within(screen.getByRole("group", { name: "Add a block" })).getByRole("button", { name: "Divider" }));
    expect(list().map((li) => li.getAttribute("aria-label"))).toEqual(["Heading 1", "Button 1", "Divider 1"]);
    fireEvent.click(screen.getByRole("button", { name: "Move up: Divider 1" }));
    expect(list().map((li) => li.getAttribute("aria-label"))).toEqual(["Heading 1", "Divider 1", "Button 1"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove: Heading 1" }));
    expect(list().map((li) => li.getAttribute("aria-label"))).toEqual(["Divider 1", "Button 1"]);
  });

  it("shows a sending campaign's results and stops it", async () => {
    const calls = backend({
      [`GET ${BASE}/c1`]: { campaign: campaign({ status: "sending", startedAt: "2026-11-13T09:00:00.000Z", stats: { ...STATS, recipients: 300, sent: 120, delivered: 100, opened: 40 } }) },
      [`GET ${BASE}/c1/recipients`]: { recipients: [{ id: "r1", email: "mona@example.com", status: "sent", error: null, attempts: 1, sentAt: "2026-11-13T09:01:00.000Z", deliveryStatus: "delivered", openedAt: "2026-11-13T10:00:00.000Z", clickedAt: null, unsubscribedAt: null }], nextCursor: null },
      [`POST ${BASE}/c1/cancel`]: { campaign: campaign({ status: "cancelled", stats: { ...STATS, recipients: 300, sent: 120 } }) },
    });
    renderWithProviders(<EmailCampaignEditorPage />, { route: "/marketing/email-campaigns/c1", path: "/marketing/email-campaigns/:campaignId" });
    expect(await screen.findByRole("heading", { name: "Results" })).toBeInTheDocument();
    expect(await screen.findByText("mona@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel sending" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel sending" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/email-campaigns/c1/cancel")).toHaveLength(1));
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });

  it("is Arabic and right to left in Arabic", async () => {
    backend();
    renderWithProviders(<EmailCampaignEditorPage />, { route: "/marketing/email-campaigns/new", path: "/marketing/email-campaigns/:campaignId", locale: "ar" });
    expect(await screen.findByRole("heading", { name: "حملة بريد جديدة" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("radio", { name: /كل المشتركين/ })).toBeChecked();
  });
});

describe("the form", () => {
  it("turns a saved campaign into the form and back without change", () => {
    const c = campaign({ preheader: "Only today", audience: { type: "rules", rules: { minSpent: 50000, lastOrderWithinDays: 30 } } });
    const body = payloadOf(formOf(c));
    expect(body).toEqual({
      name: c.name,
      subject: c.subject,
      preheader: "Only today",
      locale: "en",
      replyTo: "hello@nour.example",
      audience: { type: "rules", rules: { minSpent: 50000, lastOrderWithinDays: 30 } },
      blocks: c.blocks,
    });
  });

  it("asks for a name, a subject and complete blocks before sending", () => {
    const form = { ...blankForm("ar", null), blocks: [emptyBlock("image")] };
    expect(validate(form, { forSending: true })).toEqual(
      expect.objectContaining({ name: "required", subject: "incompleteSubject", [`blocks.${form.blocks[0].key}.url`]: "required" })
    );
    const ok = { ...form, name: "N", subject: "S", blocks: [{ ...emptyBlock("divider") }] };
    expect(validate(ok, { forSending: true })).toEqual({});
    expect(validate({ ...ok, audienceKind: "rules" as const })).toEqual({ audience: "rulesNeedOne" });
  });
});

describe("with the switch off", () => {
  it("is off unless the build turns it on, and its addresses go to /marketing", () => {
    expect(EMAIL_CAMPAIGNS_ENABLED).toBe(false);
    expect(app).toContain('<Route path="/marketing/email-campaigns" element={EMAIL_CAMPAIGNS_ENABLED ? <LazyRoute><EmailCampaignsPage /></LazyRoute> : <Navigate to="/marketing" replace />} />');
    expect(app).toContain('<Route path="/marketing/email-campaigns/:campaignId" element={EMAIL_CAMPAIGNS_ENABLED ? <LazyRoute><EmailCampaignEditorPage /></LazyRoute> : <Navigate to="/marketing" replace />} />');
  });
});
