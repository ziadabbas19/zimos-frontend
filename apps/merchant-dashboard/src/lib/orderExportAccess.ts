/**
 * Who may download the orders as a CSV file: orders.view and orders.export
 * (Backend core/security/permissions.js). Of the system roles only the owner
 * ("*") holds orders.export; the ones below don't. The dashboard only sees the
 * role key, so a custom role reads as allowed — the server still decides, and
 * a 403 comes back as the dialog's permission message. Same approach as
 * lib/analyticsAccess.ts.
 */
export const NO_ORDER_EXPORT_ROLES: ReadonlySet<string> = new Set([
  "workspace_manager",
  "editor",
  "order_operator",
  "confirmation_agent",
  "accountant",
]);

/** False only for a known system role without orders.export. */
export function canExportOrders(role: string | null | undefined): boolean {
  return !NO_ORDER_EXPORT_ROLES.has(role ?? "");
}
