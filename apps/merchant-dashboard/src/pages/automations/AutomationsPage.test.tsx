import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { AutomationFlowRule, AutomationFlowRun, AutomationFlowTemplate, AutomationStepType } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AutomationsPage } from "./AutomationsPage";

const TRIGGERS = [
  "order.created",
  "order.confirmed",
  "order.rejected",
  "order.cancelled",
  "order.shipped",
  "order.out_for_delivery",
  "order.delivered",
];
const TOKENS = ["customer_name", "order_number", "order_total", "store_name", "tracking_url", "city"];
const STEP_TYPES: AutomationStepType[] = ["wait", "whatsapp_template", "sms", "email", "webhook", "add_tag", "set_status", "notify_team"];

const rule = fake<AutomationFlowRule>({
  id: "rule_1",
  name: "Shipped notice",
  trigger: "order.shipped",
  isActive: true,
  templateKey: null,
  conditions: {},
  actions: [
    { type: "whatsapp_template", template: "order_shipped", language: "ar", params: ["{{customer_name}}"] },
  ],
  stats: { sent: 3, skipped: 0, failed: 1, lastRunAt: "2026-09-14T09:00:00.000Z" },
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
});

const run = fake<AutomationFlowRun>({
  id: "run_1",
  ruleId: "rule_1",
  trigger: "order.shipped",
  status: "failed",
  detail: "Template not approved",
  stepIndex: 0,
  stepType: "whatsapp_template",
  executionId: "exe_1",
  createdAt: "2026-09-14T09:00:00.000Z",
  order: { id: "ord_1", orderNumber: "#1001" },
});

const template = fake<AutomationFlowTemplate>({
  key: "abandoned_cart",
  trigger: "checkout.abandoned",
  name: { ar: "تذكير السلة", en: "Abandoned cart reminder" },
  description: { ar: "رسالة لمن ترك السلة", en: "A message to shoppers who left their cart" },
  conditions: {},
  steps: [],
  whatsappTemplates: [],
  ruleId: null,
});

/**
 * The page reads and writes automations through api.request: answers each
 * "METHOD path" given, and leaves anything else pending.
 */
function serve(routes: Record<string, unknown>) {
  api.request.mockImplementation(((path: string, opts?: { method?: string }) => {
    const key = `${opts?.method ?? "GET"} ${path}`;
    return key in routes ? Promise.resolve(routes[key]) : new Promise<never>(() => undefined);
  }) as never);
}

const lists = (rules: AutomationFlowRule[], runs: AutomationFlowRun[], templates: AutomationFlowTemplate[]) => ({
  "GET /workspaces/ws_1/automations": { rules, triggers: TRIGGERS, tokens: TOKENS, stepTypes: STEP_TYPES },
  "GET /workspaces/ws_1/automations/runs?limit=50": { runs, nextCursor: null },
  "GET /workspaces/ws_1/automations/templates": { templates },
});

describe("AutomationsPage", () => {
  it("warns when WhatsApp isn't connected and lists templates, rules and runs", async () => {
    api.getWhatsappIntegration.mockResolvedValue({ connected: false });
    serve(lists([rule], [run], [template]));

    renderWithProviders(<AutomationsPage />, { route: "/automations" });

    expect(await screen.findByRole("link", { name: "Connect WhatsApp" })).toHaveAttribute(
      "href",
      "/settings#whatsapp"
    );
    expect(await screen.findByText("Abandoned cart reminder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch on" })).toBeInTheDocument();
    expect((await screen.findAllByText("Shipped notice")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Template not approved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#1001" })).toHaveAttribute("href", "/orders/ord_1");
    expect(screen.getByRole("switch", { name: "Active: Shipped notice" })).toBeChecked();
  });

  it("shows the WhatsApp confirmation template locked when the plan lacks it, with the way to the plans", async () => {
    api.getWhatsappIntegration.mockResolvedValue(fake({ connected: true, status: "connected" }));
    const locked = fake<AutomationFlowTemplate>({
      ...template,
      key: "order_confirmation",
      trigger: "order.created",
      name: { ar: "تأكيد الطلب عبر واتساب", en: "Confirm orders on WhatsApp" },
      planLocked: true,
    });
    serve(lists([], [], [locked, template]));
    renderWithProviders(<AutomationsPage />, { route: "/automations" });

    expect(await screen.findByText("Confirm orders on WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Not in your current plan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the plans" })).toHaveAttribute("href", "/subscription");
    // Only the other template offers the switch.
    expect(screen.getAllByRole("button", { name: "Switch on" })).toHaveLength(1);
  });

  it("creates a rule with a token inserted into a template variable", async () => {
    api.getWhatsappIntegration.mockResolvedValue(fake({ connected: true, status: "connected" }));
    serve({
      ...lists([], [], []),
      "POST /workspaces/ws_1/automations": { rule: { ...rule, id: "rule_2", name: "Confirmed thanks", trigger: "order.confirmed" } },
    });

    const { user } = renderWithProviders(<AutomationsPage />, { route: "/automations" });

    expect(await screen.findByText("No automations yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Connect WhatsApp" })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /New automation/ })[0]);
    await user.type(await screen.findByLabelText(/^Name/), "Confirmed thanks");
    await user.selectOptions(screen.getByLabelText("When this happens"), "order.confirmed");
    await user.type(screen.getByLabelText("Template name"), "order_confirmed");
    // A new WhatsApp step starts with no variables.
    await user.click(screen.getByRole("button", { name: "Add variable" }));
    await user.click(screen.getByRole("textbox", { name: "Variable 1" }));
    await user.click(screen.getByRole("button", { name: "customer_name" }));
    expect(screen.getByRole("textbox", { name: "Variable 1" })).toHaveValue("{{customer_name}}");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/automations", {
      method: "POST",
      body: {
        name: "Confirmed thanks",
        trigger: "order.confirmed",
        conditions: {
          paymentMethod: null,
          minTotalAmount: null,
          source: null,
          governorates: [],
          tags: [],
          isFirstOrder: null,
          riskLevel: [],
          couponCode: null,
          segmentId: null,
          excludeSegmentId: null,
          stopOnStatusChange: true,
          productIds: [],
          funnelIds: [],
        },
        actions: [
          {
            type: "whatsapp_template",
            template: "order_confirmed",
            language: "ar",
            params: ["{{customer_name}}"],
          },
        ],
      },
    });
    expect(await screen.findByText("Automation created.")).toBeInTheDocument();
  });
});
