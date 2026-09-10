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
}

export function PageHeader({ title, titleMeta, titleBadge, description, back, actions }: PageHeaderProps) {
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
              <span className="ml-2 align-middle text-base font-normal text-ink-soft">
                · {titleMeta}
              </span>
            )}
            {titleBadge && <span className="ml-2 align-middle">{titleBadge}</span>}
          </h1>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
