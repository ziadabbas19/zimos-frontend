import type { Permission } from "@store-builder/api-client";

/**
 * The server's own check, on the permissions it sent with the store list
 * (Workspace.permissions): a role holds a permission when its list names it
 * or holds '*' (backend core/middleware/tenantContext hasPermission, used by
 * every requirePermission / requireAnyPermission in core/middleware/rbac).
 *
 * Unknown permissions (an API from before it sent them, or a store not read
 * yet) count as held: the page opens and the server answers for itself, as
 * the dashboard always did for a custom role.
 */
export function hasPermission(permissions: readonly string[] | null | undefined, permission: Permission): boolean {
  if (!permissions) return true;
  return permissions.includes("*") || permissions.includes(permission);
}

/** requireAnyPermission: at least one of `required`. An empty list asks for nothing. */
export function hasAnyPermission(permissions: readonly string[] | null | undefined, required: readonly Permission[] | undefined): boolean {
  if (!required || required.length === 0) return true;
  return required.some((permission) => hasPermission(permissions, permission));
}
