import { commonText } from "@/lib/commonStrings";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { overlayTarget } from "./overlayRoot";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * The merchant dashboard's dialog: a glass pane over the dimmed page.
 *
 * Drawn in the layout's overlay root (overlayRoot.tsx), not where it is used:
 * a backdrop-blur or an entrance transform on any ancestor (the toolbar, the
 * page column, a Drawer around a Modal) would otherwise make position: fixed
 * follow that box instead of the window. The target is picked once per
 * instance, on first open, so the dialog's content is never remounted.
 */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const target = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  target.current ??= overlayTarget();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-12" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("zimos-glass glass-dialog w-full max-w-lg rounded-[var(--radius-card)]", className)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={commonText().close}
            className="-me-1.5 -mt-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    target.current
  );
}
