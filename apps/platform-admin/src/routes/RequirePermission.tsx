import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/LocaleContext";
import { useLandingPath } from "@/lib/nav";
import type { PermissionCheck } from "@/lib/permissions";
import { SHELL_STRINGS } from "@/lib/shellStrings";

/**
 * Renders `children` only for an account holding `permission`. The backend
 * refuses the page's endpoints anyway; this keeps the page from rendering a
 * row of 403s.
 *
 * Anyone else goes to the first page they can open, whether they typed the
 * address, followed an old link, or just lost the permission on this page. An
 * account that can open nothing at all stays in the frame and is told so; its
 * account menu is how it signs out.
 */
export function RequirePermission({ permission, children }: { permission: PermissionCheck; children: ReactNode }) {
  const { can } = useAuth();
  const landing = useLandingPath();
  const t = useT(SHELL_STRINGS);
  if (can(permission)) return <>{children}</>;
  if (landing) return <Navigate to={landing} replace />;
  return <Alert variant="danger">{t.noSections}</Alert>;
}
