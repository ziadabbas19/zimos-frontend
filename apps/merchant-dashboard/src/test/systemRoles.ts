/**
 * The six system roles' permissions as GET /workspaces sends them, copied
 * from the backend's core/security/permissions.js SYSTEM_ROLES for tests. The
 * dashboard itself never holds this list: it reads each store's permissions
 * from the server (Workspace.permissions).
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  owner: ["*"],
  workspace_manager: [
    "workspace.manage",
    "users.manage",
    "roles.manage",
    "website.edit",
    "website.publish",
    "template.manage",
    "domain.manage",
    "products.manage",
    "products.view",
    "inventory.manage",
    "inventory.view",
    "funnels.manage",
    "funnels.publish",
    "orders.view",
    "orders.manage",
    "customers.view",
    "customers.manage",
    "form_submissions.view",
    "shipping.manage",
    "tax.manage",
    "refunds.manage",
    "discounts.manage",
    "analytics.view",
    "financial_reports.view",
    "profit.manage",
    "api_keys.manage",
    "webhooks.manage",
    "automations.manage",
    "audit_log.view",
  ],
  editor: ["website.edit", "template.manage", "products.manage", "products.view", "funnels.manage", "inventory.view"],
  order_operator: ["orders.view", "orders.manage", "inventory.view", "customers.view", "shipping.manage", "products.view"],
  confirmation_agent: ["orders.view", "orders.confirm", "customers.view"],
  accountant: ["orders.view", "refunds.manage", "tax.manage", "financial_reports.view", "profit.manage", "analytics.view", "billing.manage"],
};

export const SYSTEM_ROLES = Object.keys(SYSTEM_ROLE_PERMISSIONS);
