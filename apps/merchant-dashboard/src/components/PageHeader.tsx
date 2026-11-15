import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  /** Small muted text after the title, e.g. a product code "#482910573". */
  titleMeta?: string;
  /** Rendered on the title line, after the title and any `titleMeta`. */
  titleBadge?: ReactNode;
  description?: string;
  /** Renders a "← label" link above the title. */
  back?: { to: string; label: string };
  actions?: ReactNode;
  /** The page's one creation action; it closes the actions row. */
  primaryAction?: ReactNode;
}

/**
 * A page's primary action on a phone: fixed above the bottom edge and as wide
 * as the page, one big thumb target. Hidden from md up, where the action sits
 * in the header instead.
 */
export function PageActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      data-page-action
      className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md md:hidden [&>*]:min-h-11 [&>*]:w-full [&>*]:justify-center [&>*]:shadow-[var(--shadow-card)]"
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, titleMeta, titleBadge, description, back, actions, primaryAction }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-block text-sm text-ink-soft transition-colors hover:text-primary"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">
            {title}
            {titleMeta && (
              <span className="ms-2 align-middle text-base font-normal text-ink-soft">
                · {titleMeta}
              </span>
            )}
            {titleBadge && <span className="ms-2 align-middle">{titleBadge}</span>}
          </h1>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        {(actions || primaryAction) && (
          <div className="flex items-center gap-2">
            {actions}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  );
}
