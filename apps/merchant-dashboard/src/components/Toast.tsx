import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (m) => notify("success", m),
      error: (m) => notify("error", m),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            className={cn(
              "cursor-pointer pointer-events-auto w-full max-w-md rounded-[0.5rem] border px-4 py-3 text-left text-sm shadow-lg transition-colors",
              toast.kind === "success"
                ? "border-success/30 bg-success-soft text-success"
                : "border-danger/30 bg-danger-soft text-danger"
            )}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
