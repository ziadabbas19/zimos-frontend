/**
 * Automations as step sequences (backend: src/modules/automations).
 *
 * Mounted at /workspaces/:workspaceId/automations (automations.manage). A
 * rule is: a trigger, conditions, and an ordered list of steps — some of
 * which wait. All exported names are prefixed `automationFlows` /
 * `AutomationFlow` / `AutomationStep` so they sit beside the older
 * single-WhatsApp-action types in types.ts without clashing.
 *
 * `triggers`, `tokens` and `stepTypes` come from the server with the rules:
 * treat them as open sets (a newer backend may know more).
 *
 * Validation (422): a sequence needs 1–12 steps, at least one that is not a
 * wait, and may not end on a wait; each step's fields depend on its type.
 */
import type { ApiClient } from "../client";
import type { PaymentMethod } from "../types";

export type AutomationStepType =
  | "wait"
  | "whatsapp_template"
  | "sms"
  | "email"
  | "webhook"
  | "add_tag"
  | "set_status"
  | "notify_team";

export type AutomationWaitUnit = "minutes" | "hours" | "days";

export type AutomationStep =
  | { type: "wait"; amount: number; unit: AutomationWaitUnit }
  | { type: "whatsapp_template"; template: string; language: string; params: string[] }
  | { type: "sms"; body: string }
  | { type: "email"; subject: string; body: string }
  | { type: "webhook"; url: string }
  | { type: "add_tag"; tag: string }
  | { type: "set_status"; status: "confirmed" | "cancelled" }
  | { type: "notify_team"; message: string };

export interface AutomationFlowConditions {
  paymentMethod?: PaymentMethod | null;
  /** Minor units. */
  minTotalAmount?: number | null;
  productIds?: string[];
  governorates?: string[];
  source?: "store" | "funnel" | null;
  funnelIds?: string[];
  riskLevel?: Array<"low" | "medium" | "high">;
  isFirstOrder?: boolean | null;
  tags?: string[];
  /** Stop a waiting sequence when the order's status changed meanwhile. Default true. */
  stopOnStatusChange?: boolean;
  /** `review.request` only: days after delivery. Default 3. */
  delayDays?: number;
  /** The value of `{{coupon_code}}` in this rule's messages. */
  couponCode?: string | null;
  /** Only contacts in this segment, checked when the rule starts (any trigger with a contact). */
  segmentId?: string | null;
  /** Never contacts in this segment. */
  excludeSegmentId?: string | null;
}

export interface AutomationFlowRule {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  /** The ready-made template this rule came from, if any. */
  templateKey: string | null;
  conditions: AutomationFlowConditions;
  actions: AutomationStep[];
  createdAt: string;
  updatedAt: string;
  stats: { sent: number; skipped: number; failed: number; lastRunAt: string | null };
}

export interface AutomationFlowList {
  rules: AutomationFlowRule[];
  triggers: string[];
  tokens: string[];
  stepTypes: AutomationStepType[];
}

export interface AutomationFlowPayload {
  name: string;
  trigger: string;
  isActive?: boolean;
  conditions?: AutomationFlowConditions;
  actions: AutomationStep[];
}

export type AutomationFlowRunStatus = "sent" | "skipped" | "failed";

/** One step of one run of a rule (or the reason the rule was skipped). */
export interface AutomationFlowRun {
  id: string;
  ruleId: string | null;
  trigger: string;
  status: AutomationFlowRunStatus;
  detail: string | null;
  stepIndex: number | null;
  stepType: AutomationStepType | null;
  executionId: string | null;
  createdAt: string;
  order: { id: string; orderNumber: string | null } | null;
}

/** A WhatsApp message template the merchant must have approved in their own Meta account. */
export interface AutomationWhatsappTemplateHint {
  name: string;
  body: string;
  buttons?: string[];
}

export interface AutomationFlowTemplate {
  key: string;
  trigger: string;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  conditions: AutomationFlowConditions;
  steps: AutomationStep[];
  whatsappTemplates: AutomationWhatsappTemplateHint[];
  /** The rule this store already created from the template, or null. */
  ruleId: string | null;
  /** Switched on with a coupon code, its last message offers it (abandoned cart). */
  acceptsCoupon?: boolean;
  /**
   * Switching it on would be refused (403 PLAN_FEATURE_REQUIRED): the WhatsApp
   * order confirmation while the plan gate is on and the plan lacks
   * whatsapp_confirmation. Never set once the store has the rule.
   */
  planLocked?: boolean;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/automations`;

export async function automationFlowsList(client: ApiClient, workspaceId: string): Promise<AutomationFlowList> {
  return client.request<AutomationFlowList>(base(workspaceId));
}

export async function automationFlowsCreate(
  client: ApiClient,
  workspaceId: string,
  payload: AutomationFlowPayload
): Promise<AutomationFlowRule> {
  const { rule } = await client.request<{ rule: AutomationFlowRule }>(base(workspaceId), { method: "POST", body: payload });
  return rule;
}

export async function automationFlowsUpdate(
  client: ApiClient,
  workspaceId: string,
  ruleId: string,
  payload: Partial<AutomationFlowPayload>
): Promise<AutomationFlowRule> {
  const { rule } = await client.request<{ rule: AutomationFlowRule }>(`${base(workspaceId)}/${ruleId}`, {
    method: "PATCH",
    body: payload,
  });
  return rule;
}

/** The rule's past runs stay in the log. */
export async function automationFlowsDelete(client: ApiClient, workspaceId: string, ruleId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${ruleId}`, { method: "DELETE" });
}

export async function automationFlowsListRuns(
  client: ApiClient,
  workspaceId: string,
  params: { ruleId?: string; status?: AutomationFlowRunStatus; limit?: number; before?: string | null } = {}
): Promise<{ runs: AutomationFlowRun[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params.ruleId) query.set("ruleId", params.ruleId);
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.before) query.set("before", params.before);
  const qs = query.toString();
  return client.request(`${base(workspaceId)}/runs${qs ? `?${qs}` : ""}`);
}

export async function automationFlowsListTemplates(client: ApiClient, workspaceId: string): Promise<AutomationFlowTemplate[]> {
  const { templates } = await client.request<{ templates: AutomationFlowTemplate[] }>(`${base(workspaceId)}/templates`);
  return templates;
}

/** Turns a ready-made template into a rule of this store. A second call returns the same rule (`created: false`). */
export async function automationFlowsEnableTemplate(
  client: ApiClient,
  workspaceId: string,
  key: string,
  locale: "ar" | "en",
  /** For a template that offers one (`acceptsCoupon`): the code its last message gives. */
  opts: { couponCode?: string } = {}
): Promise<{ rule: AutomationFlowRule; created: boolean }> {
  return client.request(`${base(workspaceId)}/templates/${encodeURIComponent(key)}/enable`, {
    method: "POST",
    body: { locale, ...(opts.couponCode ? { couponCode: opts.couponCode } : {}) },
  });
}
