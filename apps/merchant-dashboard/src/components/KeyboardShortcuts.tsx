import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuardedLeave } from "@/lib/useUnsavedGuard";
import { useWorkspace } from "@/context/WorkspaceContext";
import { findNavItem, isNavItemVisible } from "@/lib/navigation";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";

/** Fired on `window` to open the list of shortcuts (the account menu does). */
export const SHORTCUTS_HELP_EVENT = "zimos:shortcuts-help";
/** Fired on `window` to switch full screen on or off (the layout listens). */
export const FOCUS_TOGGLE_EVENT = "zimos:focus-toggle";

const STRINGS = {
  en: {
    title: "Keyboard shortcuts",
    description: "They work anywhere in the dashboard, except while you are typing in a field.",
    do: "Do",
    go: "Go to — press G, then the letter",
    search: "Search and jump to any page",
    help: "Show this list",
    focus: "Full screen: hide or show the side menu",
    newOrder: "New order",
    newProduct: "Add product",
    home: "Home",
    orders: "Orders",
    confirm: "Orders to confirm",
    products: "Products",
    customers: "Customers",
    analytics: "Analytics",
    affiliates: "Affiliates",
    website: "Website",
    settings: "Settings",
    then: "then",
  },
  ar: {
    title: "اختصارات الكيبورد",
    description: "تعمل في أي مكان في الداشبورد، إلا وأنت تكتب داخل حقل.",
    do: "تنفيذ",
    go: "انتقال — اضغط G ثم الحرف",
    search: "بحث وانتقال لأي صفحة",
    help: "عرض هذه القائمة",
    focus: "ملء الشاشة: إخفاء أو إظهار القائمة الجانبية",
    newOrder: "طلب جديد",
    newProduct: "إضافة منتج",
    home: "الرئيسية",
    orders: "الطلبات",
    confirm: "طلبات تنتظر التأكيد",
    products: "المنتجات",
    customers: "العملاء",
    analytics: "التحليلات",
    affiliates: "المسوّقون",
    website: "الموقع",
    settings: "الإعدادات",
    then: "ثم",
  },
} satisfies Messages;

type Label = keyof (typeof STRINGS)["en"];

/** One key. Matched by physical key, so they work on an Arabic layout too. */
const DIRECT: Array<{ code: string; cap: string; to: string; label: Label }> = [
  { code: "KeyN", cap: "N", to: "/orders/new", label: "newOrder" },
  { code: "KeyP", cap: "P", to: "/catalog/new", label: "newProduct" },
];

/** G, then one key. */
const GO: Array<{ code: string; cap: string; to: string; label: Label }> = [
  { code: "KeyH", cap: "H", to: "/", label: "home" },
  { code: "KeyO", cap: "O", to: "/orders", label: "orders" },
  { code: "KeyC", cap: "C", to: "/confirmation-queue", label: "confirm" },
  { code: "KeyP", cap: "P", to: "/catalog", label: "products" },
  { code: "KeyU", cap: "U", to: "/customers", label: "customers" },
  { code: "KeyA", cap: "A", to: "/analytics", label: "analytics" },
  { code: "KeyM", cap: "M", to: "/affiliates", label: "affiliates" },
  { code: "KeyW", cap: "W", to: "/website", label: "website" },
  { code: "KeyS", cap: "S", to: "/settings", label: "settings" },
];

function Key({ children }: { children: string }) {
  return <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-xs font-medium text-ink">{children}</kbd>;
}

/**
 * Dashboard-wide keyboard shortcuts and the dialog that lists them. Mounted
 * once in the layout. Nothing fires while a field has focus, while a dialog
 * is open, or with Ctrl/Alt/Cmd held, so typing and browser shortcuts are
 * never taken over.
 */
export function KeyboardShortcuts() {
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role;
  const [open, setOpen] = useState(false);
  // The handler reads the latest role and dialog state without re-subscribing.
  const leave = useGuardedLeave();
  const state = useRef({ role, open, leave });
  state.current = { role, open, leave };

  useEffect(() => {
    let waitingForSecondKey = false;
    let timer: number | undefined;

    const go = (to: string) => {
      const item = findNavItem(to);
      if (item && !isNavItemVisible(item, state.current.role)) return;
      // Unsaved changes on the page: asks before going.
      state.current.leave(() => navigate(to));
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (state.current.open || document.querySelector('[role="dialog"], [role="menu"]')) return;

      if (e.code === "Slash") {
        e.preventDefault();
        if (e.shiftKey) setOpen(true);
        // The search palette owns Ctrl+K; "/" is the one-key way to it.
        else window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
        return;
      }
      if (e.shiftKey) return;

      if (waitingForSecondKey) {
        waitingForSecondKey = false;
        window.clearTimeout(timer);
        const destination = GO.find((entry) => entry.code === e.code);
        if (destination) {
          e.preventDefault();
          go(destination.to);
        }
        return;
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        window.dispatchEvent(new Event(FOCUS_TOGGLE_EVENT));
        return;
      }
      if (e.code === "KeyG") {
        waitingForSecondKey = true;
        timer = window.setTimeout(() => {
          waitingForSecondKey = false;
        }, 1500);
        return;
      }
      const action = DIRECT.find((entry) => entry.code === e.code);
      if (action) {
        e.preventDefault();
        go(action.to);
      }
    };

    const onHelp = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(SHORTCUTS_HELP_EVENT, onHelp);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SHORTCUTS_HELP_EVENT, onHelp);
    };
  }, [navigate]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t.title} description={t.description}>
      <div className="space-y-5 text-sm">
        <section>
          <h3 className="text-xs font-semibold text-ink-soft">{t.do}</h3>
          <ul className="mt-2 divide-y divide-line">
            {DIRECT.map((entry) => (
              <Row key={entry.code} label={t[entry.label]} keys={[entry.cap]} />
            ))}
            <Row label={t.focus} keys={["F"]} />
            <Row label={t.search} keys={["/"]} />
            <Row label={t.help} keys={["?"]} />
          </ul>
        </section>
        <section>
          <h3 className="text-xs font-semibold text-ink-soft">{t.go}</h3>
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {GO.map((entry) => (
              <Row key={entry.code} label={t[entry.label]} keys={["G", entry.cap]} then={t.then} />
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}

function Row({ label, keys, then }: { label: string; keys: string[]; then?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 truncate text-ink">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5" dir="ltr">
        {keys.map((key, index) => (
          <span key={key + index} className="flex items-center gap-1.5">
            {index > 0 && <span className="text-xs text-ink-soft">{then}</span>}
            <Key>{key}</Key>
          </span>
        ))}
      </span>
    </li>
  );
}
