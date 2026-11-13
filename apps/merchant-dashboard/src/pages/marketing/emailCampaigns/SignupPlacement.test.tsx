import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { EMAIL_SIGNUP_DEFAULTS, type EmailCampaign, type EmailCampaignOverview, type EmailSignupView } from "@store-builder/api-client";
import { callsTo, fakeBackend, type FakeCall } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EmailCampaignsPage } from "./EmailCampaignsPage";
import { EmailCampaignEditorPage } from "./EmailCampaignEditorPage";
import { QuotaMeter } from "./QuotaMeter";
import { campaignLimitProblem } from "./campaignLimits";

// Marketing → Email campaigns → Signup placement (`?tab=signup`): the places,
// the ticked-by-default switch and its hint, the popup's trigger, the words,
// the numbers by source, the live preview, loading, empty and error states,
// Arabic right to left. And the plan's campaign limits on the quota meter and
// the Send button.

const BASE = "/workspaces/ws_1/email-campaigns";
const PLAN_OPEN = { "GET /plan-features": { planFeatures: { features: [], enforced: false } } };
const ROUTE = "/marketing/email-campaigns?tab=signup";

const VIEW: EmailSignupView = {
  settings: EMAIL_SIGNUP_DEFAULTS,
  stats: { subscribers: 0, bySource: { checkout: 0, quick_order: 0, cart: 0, footer: 0, popup: 0, other: 0 } },
  checkoutEmailField: "optional",
};

function backend(view: EmailSignupView = VIEW, extra: Record<string, unknown> = {}) {
  return fakeBackend({
    ...PLAN_OPEN,
    [`GET ${BASE}/signup`]: view,
    [`PUT ${BASE}/signup`]: (call: FakeCall) => ({ ...view, settings: call.body }),
    ...extra,
  });
}

const switchNamed = (name: string, scope: HTMLElement = document.body) => within(scope).getByRole("switch", { name });

describe("the signup placement section", () => {
  it("opens from its tab, with the checkout box on and unticked and the rest off, and says there are no subscribers yet", async () => {
    backend();
    renderWithProviders(<EmailCampaignsPage />, { route: ROUTE });
    expect(await screen.findByRole("tab", { name: "Signup placement" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(/No subscribers yet/)).toBeInTheDocument();
    const checkout = document.querySelector<HTMLElement>("[data-place='checkout']")!;
    expect(switchNamed("Checkout", checkout)).toHaveAttribute("aria-checked", "true");
    expect(switchNamed("Ticked by default", checkout)).toHaveAttribute("aria-checked", "false");
    // The neutral one-line hint under the switch; never a warning.
    expect(within(checkout).getByText("A ticked box means shoppers are subscribed unless they untick it.")).toBeInTheDocument();
    expect(switchNamed("Quick order form")).toHaveAttribute("aria-checked", "false");
    expect(switchNamed("Cart")).toHaveAttribute("aria-checked", "false");
    expect(switchNamed("Footer")).toHaveAttribute("aria-checked", "false");
    expect(switchNamed("Popup")).toHaveAttribute("aria-checked", "false");
  });

  it("shows a skeleton while loading, and an error with a way to try again", async () => {
    let fail = true;
    fakeBackend({ ...PLAN_OPEN, [`GET ${BASE}/signup`]: () => (fail ? new Error("offline") : VIEW) });
    renderWithProviders(<EmailCampaignsPage />, { route: ROUTE });
    const retry = await screen.findByRole("button", { name: /try again|retry/i });
    fail = false;
    fireEvent.click(retry);
    expect(await screen.findByRole("switch", { name: "Checkout" })).toBeInTheDocument();
  });

  it("saves each place, ticked by default as the merchant chooses, the popup's trigger and the words", async () => {
    const calls = backend();
    renderWithProviders(<EmailCampaignsPage />, { route: ROUTE });
    await screen.findByRole("switch", { name: "Checkout" });

    fireEvent.click(switchNamed("Ticked by default", document.querySelector<HTMLElement>("[data-place='checkout']")!));
    fireEvent.click(switchNamed("Cart"));
    fireEvent.click(switchNamed("Footer"));
    fireEvent.click(switchNamed("Popup"));
    fireEvent.click(screen.getByRole("radio", { name: "When leaving (computer)" }));
    const seconds = screen.getByLabelText("Seconds before it shows");
    fireEvent.change(seconds, { target: { value: "2" } });
    expect(screen.getByText("Enter a whole number from 3 to 120.")).toBeInTheDocument();
    fireEvent.change(seconds, { target: { value: "25" } });
    const english = screen.getByRole("group", { name: "English" });
    fireEvent.change(within(english).getByLabelText("Incentive (optional)"), { target: { value: " 10% off your next order " } });
    const arabic = screen.getByRole("group", { name: "Arabic" });
    expect(within(arabic).getByLabelText("Box text or heading")).toHaveAttribute("dir", "rtl");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/email-campaigns/signup")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/email-campaigns/signup")[0].body).toEqual({
      checkout: { enabled: true, preTicked: true },
      quickOrder: { enabled: false, preTicked: false },
      cart: { enabled: true, preTicked: false },
      footer: { enabled: true },
      popup: { enabled: true, trigger: "exit_intent", delaySeconds: 25 },
      text: { ar: { label: null, privacy: null, incentive: null }, en: { label: null, privacy: null, incentive: "10% off your next order" } },
    });
    expect(await screen.findByText("Signup placement saved.")).toBeInTheDocument();
  });

  it("previews each place live, in either language", async () => {
    backend({ ...VIEW, settings: { ...EMAIL_SIGNUP_DEFAULTS, cart: { enabled: true, preTicked: true } } });
    renderWithProviders(<EmailCampaignsPage />, { route: ROUTE });
    await screen.findByRole("switch", { name: "Checkout" });
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).getByText("Email me offers and news from Nile Store")).toBeInTheDocument();

    fireEvent.click(within(preview).getByRole("button", { name: "Cart" }));
    expect(preview.querySelector("[data-preview-ticked='true']")).not.toBeNull();
    fireEvent.click(within(preview).getByRole("button", { name: "Popup" }));
    expect(within(preview).getByText("Off — shoppers don't see this.")).toBeInTheDocument();
    // The words follow the form as they are typed.
    const english = screen.getByRole("group", { name: "English" });
    fireEvent.change(within(english).getByLabelText("Box text or heading"), { target: { value: "Join the list" } });
    expect(within(preview).getByText("Join the list")).toBeInTheDocument();

    fireEvent.click(within(preview).getByRole("radio", { name: "Arabic" }));
    expect(preview.querySelector("[data-preview-place='popup']")).toHaveAttribute("dir", "rtl");
    expect(within(preview).getByText("خليك أول من يعرف بعروضنا على الإيميل")).toBeInTheDocument();
  });

  it("counts the subscribers by where they signed up, and says when the order form hides the email field", async () => {
    backend({
      ...VIEW,
      checkoutEmailField: "hidden",
      stats: { subscribers: 42, bySource: { checkout: 20, quick_order: 2, cart: 5, footer: 9, popup: 4, other: 2 } },
    });
    renderWithProviders(<EmailCampaignsPage />, { route: ROUTE });
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(within(document.querySelector<HTMLElement>("[data-source='footer']")!).getByText("9")).toBeInTheDocument();
    expect(within(document.querySelector<HTMLElement>("[data-source='other']")!).getByText("Earlier or elsewhere")).toBeInTheDocument();
    expect(screen.getByText(/Your order form doesn't ask for an email/)).toBeInTheDocument();
  });

  it("reads right to left in Arabic, every switch reachable by keyboard", async () => {
    backend();
    renderWithProviders(<EmailCampaignsPage />, { route: ROUTE, locale: "ar" });
    const tab = await screen.findByRole("tab", { name: "أماكن الاشتراك" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(document.documentElement.dir).toBe("rtl");
    const footer = await screen.findByRole("switch", { name: "أسفل المتجر" });
    // Real buttons: focusable, toggled by Enter or Space like any button.
    expect(footer.tagName).toBe("BUTTON");
    footer.focus();
    expect(document.activeElement).toBe(footer);
    fireEvent.click(footer);
    expect(footer).toHaveAttribute("aria-checked", "true");
  });

  it("switches between the sections, keeping the choice in the address", async () => {
    backend(VIEW, {
      [`GET ${BASE}/overview`]: {
        quota: {
          monthly: { max: 1000, used: 0, remaining: 1000, resetsAt: "2026-12-01T00:00:00.000Z" },
          daily: { cap: 1000, used: 0, remaining: 1000, resetsAt: "2026-11-14T00:00:00.000Z" },
        },
        sender: { fromName: "Nile", fromAddress: "no-reply@zimos.co", replyTo: null },
        provider: { ready: true, reportsDelivery: false, reportsEngagement: false },
        locale: "en",
        audiences: { segments: [], rfm: false },
      },
      [`GET ${BASE}`]: { campaigns: [], nextCursor: null },
    });
    renderWithProviders(<EmailCampaignsPage />, { route: "/marketing/email-campaigns" });
    expect(await screen.findByText("No campaigns yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Signup placement" }));
    expect(await screen.findByRole("switch", { name: "Checkout" })).toBeInTheDocument();
  });
});

// ------------------------------------------------------------ plan limits --

const OVERVIEW: EmailCampaignOverview = {
  quota: {
    monthly: { max: 1000, used: 250, remaining: 750, resetsAt: "2026-12-01T00:00:00.000Z" },
    daily: { cap: 1000, used: 40, remaining: 960, resetsAt: "2026-11-14T00:00:00.000Z" },
    campaigns: { max: 4, used: 1, remaining: 3, resetsAt: "2026-12-01T00:00:00.000Z" },
    recipientsPerCampaign: 500,
  },
  sender: { fromName: "Nour Store", fromAddress: "no-reply@zimos.co", replyTo: null },
  provider: { ready: true, reportsDelivery: false, reportsEngagement: false },
  locale: "en",
  audiences: { segments: [], rfm: false },
};

describe("the plan's campaign limits", () => {
  it("shows the month's campaigns against the plan and the largest audience", () => {
    renderWithProviders(<QuotaMeter overview={OVERVIEW} />);
    expect(screen.getByText("Campaigns this month: 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("Up to 500 people per campaign")).toBeInTheDocument();
  });

  it("says unlimited, and shows nothing of them for an older API", () => {
    const { unmount } = renderWithProviders(<QuotaMeter overview={{ ...OVERVIEW, quota: { ...OVERVIEW.quota, campaigns: { ...OVERVIEW.quota.campaigns!, max: null, remaining: null }, recipientsPerCampaign: null } }} />);
    expect(screen.getByText("Campaigns this month: 1 · no limit on your plan")).toBeInTheDocument();
    expect(screen.queryByText(/per campaign/)).toBeNull();
    unmount();
    const { campaigns: _c, recipientsPerCampaign: _r, ...older } = OVERVIEW.quota;
    renderWithProviders(<QuotaMeter overview={{ ...OVERVIEW, quota: older }} />);
    expect(screen.queryByText(/Campaigns this month/)).toBeNull();
  });

  it("knows what blocks a send: the month's campaigns (a scheduled one keeps its own place), or a larger audience", () => {
    const full = { ...OVERVIEW, quota: { ...OVERVIEW.quota, campaigns: { ...OVERVIEW.quota.campaigns!, used: 4, remaining: 0 } } };
    expect(campaignLimitProblem(full, { audienceSize: 10 })).toEqual(expect.objectContaining({ kind: "campaigns", max: 4, used: 4 }));
    expect(campaignLimitProblem(full, { audienceSize: 10, alreadyScheduled: true })).toBeNull();
    expect(campaignLimitProblem(OVERVIEW, { audienceSize: 501 })).toEqual({ kind: "audience", size: 501, max: 500 });
    expect(campaignLimitProblem(OVERVIEW, { audienceSize: 500 })).toBeNull();
    expect(campaignLimitProblem(OVERVIEW, { audienceSize: null })).toBeNull();
  });

  function campaign(): EmailCampaign {
    const zero = { recipients: 0, sent: 0, failed: 0, skipped: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 };
    return {
      id: "c1",
      name: "Sale",
      subject: "Sale",
      preheader: null,
      blocks: [{ type: "text", text: "Hi" }],
      locale: "en",
      replyTo: null,
      audience: { type: "all" },
      status: "draft",
      scheduledAt: null,
      startedAt: null,
      finishedAt: null,
      cancelledAt: null,
      pausedUntil: null,
      failureReason: null,
      stats: zero,
      createdAt: "2026-11-13T08:00:00.000Z",
      updatedAt: "2026-11-13T08:00:00.000Z",
    };
  }

  it.each([
    ["the audience is larger than one campaign may have", OVERVIEW, 600, "This audience is 600 people and your plan allows up to 500 per campaign. Narrow it with a segment or rules."],
    [
      "the month's campaigns are used",
      { ...OVERVIEW, quota: { ...OVERVIEW.quota, campaigns: { ...OVERVIEW.quota.campaigns!, used: 4, remaining: 0 } } },
      100,
      "Your plan allows 4 campaigns a month and 4 are already sent or scheduled.",
    ],
  ])("turns Send and Schedule off when %s, and says why", async (_why, overview, count, message) => {
    fakeBackend({
      ...PLAN_OPEN,
      [`GET ${BASE}/overview`]: overview,
      [`GET ${BASE}/c1`]: { campaign: campaign() },
      [`POST ${BASE}/audience`]: { count, subscribed: count },
    });
    renderWithProviders(<EmailCampaignEditorPage />, { route: "/marketing/email-campaigns/c1", path: "/marketing/email-campaigns/:campaignId" });
    fireEvent.click(await screen.findByRole("button", { name: /Review and send/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Send now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Schedule" })).toBeDisabled();
  });

  it("names the failure of a scheduled campaign whose audience grew too large", async () => {
    fakeBackend({
      ...PLAN_OPEN,
      [`GET ${BASE}/overview`]: OVERVIEW,
      [`GET ${BASE}/c1`]: { campaign: { ...campaign(), status: "failed", failureReason: "audience_too_large" } },
      [`GET ${BASE}/c1/recipients`]: { recipients: [], nextCursor: null },
    });
    renderWithProviders(<EmailCampaignEditorPage />, { route: "/marketing/email-campaigns/c1", path: "/marketing/email-campaigns/:campaignId" });
    expect(await screen.findByText(/by its time the audience was larger than your plan allows for one campaign/)).toBeInTheDocument();
  });
});
