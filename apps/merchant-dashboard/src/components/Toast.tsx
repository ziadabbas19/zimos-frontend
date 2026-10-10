import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { undo: "Undo", undoFailed: "We couldn't undo that, so it stays as you changed it." },
  ar: { undo: "تراجع", undoFailed: "تعذّر التراجع، لذلك بقي التعديل كما هو." },
} satisfies Messages;

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Set on an undo toast: what takes the change back. */
  onUndo?: () => void | Promise<void>;
  /** One thing to do next, named ("See your store"). */
  action?: ToastAction;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** How long it stays, in milliseconds. Left out: 4 s, 7 s for an error. */
  duration?: number;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string, options?: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  /**
   * Says what was done and offers to take it back for a few seconds. If
   * `onUndo` throws or its promise rejects, an error toast says the change is
   * still in place.
   */
  undo: (message: string, onUndo: () => void | Promise<void>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT(STRINGS);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string, options?: ToastOptions) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, message, action: options?.action }]);
      window.setTimeout(() => dismiss(id), options?.duration ?? (kind === "error" ? 7000 : 4000));
    },
    [dismiss]
  );

  const undo = useCallback(
    (message: string, onUndo: () => void | Promise<void>) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind: "success", message, onUndo }]);
      window.setTimeout(() => dismiss(id), 7000);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (m) => notify("success", m),
      error: (m) => notify("error", m),
      undo,
    }),
    [notify, undo]
  );

  async function takeBack(toast: Toast) {
    dismiss(toast.id);
    try {
      await toast.onUndo?.();
    } catch {
      notify("error", t.undoFailed);
    }
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) =>
          toast.onUndo ? (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-[0.5rem] border border-success/30 bg-success-soft px-4 py-2 text-start text-sm text-success shadow-lg"
            >
              <span className="min-w-0">{toast.message}</span>
              <button
                type="button"
                onClick={() => void takeBack(toast)}
                className="min-h-9 shrink-0 cursor-pointer rounded-full px-3 font-semibold underline underline-offset-4 hover:bg-success/10"
              >
                {t.undo}
              </button>
            </div>
          ) : toast.action ? (
            <div
              key={toast.id}
              role={toast.kind === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-[0.5rem] border px-4 py-2 text-start text-sm shadow-lg",
                toast.kind === "success" ? "border-success/30 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger"
              )}
            >
              <span className="min-w-0">{toast.message}</span>
              <button
                type="button"
                onClick={() => {
                  dismiss(toast.id);
                  toast.action?.onClick();
                }}
                className="min-h-9 shrink-0 cursor-pointer rounded-full px-3 font-semibold underline underline-offset-4 hover:bg-ink/5"
              >
                {toast.action.label}
              </button>
            </div>
          ) : (
          <button
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            className={cn(
              "cursor-pointer pointer-events-auto w-full max-w-md rounded-[0.5rem] border px-4 py-3 text-start text-sm shadow-lg transition-colors",
              toast.kind === "success"
                ? "border-success/30 bg-success-soft text-success"
                : "border-danger/30 bg-danger-soft text-danger"
            )}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            {toast.message}
          </button>
          )
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
