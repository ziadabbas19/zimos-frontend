import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { PermissionCheck } from "@/lib/permissions";

/** Renders `children` only for an account holding `permission`; nothing otherwise. */
export function Can({ permission, children }: { permission: PermissionCheck; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : null;
}

/**
 * A link to another console page. For an account that cannot open that page it
 * is the same words as plain text, not a link that would send them elsewhere.
 */
export function CanLink({
  permission,
  to,
  className,
  children,
}: {
  permission: PermissionCheck;
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const { can } = useAuth();
  if (can(permission)) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  const text = className?.split(/\s+/).filter((name) => !name.startsWith("hover:")).join(" ");
  return <span className={text || undefined}>{children}</span>;
}
