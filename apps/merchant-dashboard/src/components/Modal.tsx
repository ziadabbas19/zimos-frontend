import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]';

/** What Tab can reach inside the dialog, in order. */
function focusableIn(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => node.tabIndex >= 0 && !node.matches(":disabled") && !node.closest("[hidden]"));
}

/** Tab and Shift+Tab go round inside the dialog instead of reaching the page behind it. */
function keepFocusInside(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab") return;
  const items = focusableIn(event.currentTarget);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const current = document.activeElement;
  if (event.shiftKey && (current === first || current === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Drawn in the layout's overlay root (overlayRoot.tsx), not where it is used:
 * a bar, panel or dialog around it with backdrop-filter or a transform would
 * otherwise hold the fixed backdrop to its own box and cut the dialog off.
 * The target is picked once per instance, on first open, so the dialog's
 * content is never remounted under the merchant. Focus moves into the dialog
 * when it opens, stays there, and goes back where it was when it closes.
 */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const target = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Read while rendering: by the time an effect runs, a field with autoFocus has taken the focus.
  const focused = () => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Opened from a menu: the menu is about to go, its button is where the focus comes back to.
    return active?.closest('[role="menu"]') ? (document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]') ?? active) : active;
  };
  const [opener, setOpener] = useState(() => (open ? focused() : null));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpener(focused());
  }
  useEffect(() => {
    if (!open) return;
    const node = panel.current;
    if (node && !node.contains(document.activeElement)) (focusableIn(node)[0] ?? node).focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [open, opener]);
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
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-12"
      onMouseDown={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={keepFocusInside}
        className={cn(
          "zimos-glass glass-dialog w-full max-w-lg rounded-[var(--radius-card)] outline-none",
          className
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    target.current
  );
}
