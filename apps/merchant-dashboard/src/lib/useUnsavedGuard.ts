import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  // Same words as the Modal's own discard prompt (components/Modal.tsx): one vocabulary for one decision.
  en: {
    title: "Discard changes?",
    body: "Your changes on this tab aren't saved yet. Leave and lose them, or keep editing and save.",
    leave: "Discard",
    stay: "Keep editing",
  },
  ar: {
    title: "هل تريد ترك التعديلات؟",
    body: "التعديلات في هذا التبويب لم تُحفظ بعد. هل تتركها فتضيع، أم تواصل التعديل وتحفظها؟",
    leave: "ترك التعديلات",
    stay: "مواصلة التعديل",
  },
} satisfies Messages;

interface UnsavedGuardValue {
  dirty: boolean;
  /** Keyed by source, so two forms on one page cannot overwrite each other's flag. */
  setDirty: (source: string, dirty: boolean) => void;
  confirmLeave: () => Promise<boolean>;
}

const UnsavedGuardContext = createContext<UnsavedGuardValue | null>(null);

/**
 * One place that knows whether anything on the page is unsaved and asks
 * before it would be lost. The forms report through `useReportDirty` /
 * `useUnsavedGuard().setDirty`.
 *
 * The app mounts ONE of these around its routes (App.tsx), and a page may
 * wrap itself in its own to ask before one of its tabs is switched
 * (`confirmLeave()`). A guard inside another reports what it holds to the one
 * above, so the outermost always knows about every unsaved form on screen;
 * that outermost guard is the one that covers leaving the page:
 *
 *  - a reload or a closed tab: the browser's own prompt, armed while anything
 *    is unsaved;
 *  - a link to another page of the app (the side menu, the dock, a breadcrumb,
 *    a link in the page): the app is a plain BrowserRouter with no route
 *    blockers, so the click is caught before React Router sees it, the
 *    question is asked, and the link is followed only on "leave". A link that
 *    opens a new tab, a link to another site, a modified click and a link that
 *    stays on this page (its tabs, its filters) pass untouched.
 *
 * The shell's ways out that are not links (search, keyboard shortcuts, a
 * notification) go through `useGuardedLeave()`. The browser's Back button is
 * not caught.
 */
export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const t = useT(STRINGS);
  const parent = useContext(UnsavedGuardContext);
  const outermost = parent === null;
  const inRouter = useInRouterContext();
  const self = useId();
  const [dirtySources, setDirtySources] = useState<ReadonlySet<string>>(() => new Set<string>());
  const dirty = dirtySources.size > 0;
  // The open question, if there is one. Calling it answers it and closes the dialog.
  const [pending, setPending] = useState<((leave: boolean) => void) | null>(null);
  const pendingPromise = useRef<Promise<boolean> | null>(null);

  const setDirty = useCallback((source: string, value: boolean) => {
    setDirtySources((prev) => {
      if (prev.has(source) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(source);
      else next.delete(source);
      return next;
    });
  }, []);

  // A guard inside another: what it holds counts for the one above, and goes with it.
  const reportUp = parent?.setDirty;
  useEffect(() => {
    reportUp?.(self, dirty);
  }, [reportUp, self, dirty]);
  useEffect(() => {
    return () => {
      reportUp?.(self, false);
    };
  }, [reportUp, self]);

  const confirmLeave = useCallback(() => {
    if (!dirty) return Promise.resolve(true);
    // A second question while one is open shares its answer.
    if (pendingPromise.current) return pendingPromise.current;
    const promise = new Promise<boolean>((resolve) => {
      setPending(() => (leave: boolean) => {
        pendingPromise.current = null;
        setPending(null);
        resolve(leave);
      });
    });
    pendingPromise.current = promise;
    return promise;
  }, [dirty]);

  // Nothing left to lose while the question is open (the form saved, or went away): let it through.
  useEffect(() => {
    if (!dirty && pending) pending(true);
  }, [dirty, pending]);

  // Reload / close. The browser shows its own wording; the string is what older ones require.
  useEffect(() => {
    if (!dirty || !outermost) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, outermost]);

  const value = useMemo<UnsavedGuardValue>(
    () => ({ dirty, setDirty, confirmLeave }),
    [dirty, setDirty, confirmLeave]
  );

  // A .ts file, hence createElement: the same tree as
  // <Provider value>{children}<LinkGuard … /><ConfirmDialog … /></Provider>.
  return createElement(
    UnsavedGuardContext.Provider,
    { value },
    children,
    // Only while there is something to lose, so a page with nothing unsaved has no listener at all.
    outermost && inRouter && dirty ? createElement(LinkGuard, { confirmLeave }) : null,
    createElement(ConfirmDialog, {
      open: pending !== null,
      title: t.title,
      description: t.body,
      confirmLabel: t.leave,
      cancelLabel: t.stay,
      destructive: true,
      onCancel: () => pending?.(false),
      onConfirm: () => pending?.(true),
    })
  );
}

/**
 * Catches a plain click on a link that would take the merchant to another
 * page of the app, asks, and follows the link only on "leave". Listens on the
 * document in the capture phase, so it also covers the links outside the page
 * (the side menu, the dock) and runs before any handler of the link itself.
 */
function LinkGuard({ confirmLeave }: { confirmLeave: () => Promise<boolean> }): null {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The listener is attached once and reaches the newest values through this.
  const latest = useRef({ confirmLeave, navigate, pathname });
  useEffect(() => {
    latest.current = { confirmLeave, navigate, pathname };
  });

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // The same page: one of its tabs or filters, or a place on it.
      if (url.pathname === latest.current.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      const to = `${url.pathname}${url.search}${url.hash}`;
      void latest.current.confirmLeave().then((leave) => {
        if (leave) latest.current.navigate(to);
      });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

function alwaysLeave() {
  return Promise.resolve(true);
}

/**
 * How a form reports unsaved edits, and how a tab switch asks before dropping
 * them. `confirmLeave()` answers true at once when nothing is dirty, otherwise
 * it opens the dialog and answers with the merchant's choice. Outside a
 * provider nothing is guarded: `setDirty` is a no-op and leaving is always
 * fine, so a form can render on its own.
 */
export function useUnsavedGuard(): {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmLeave: () => Promise<boolean>;
} {
  const ctx = useContext(UnsavedGuardContext);
  const source = useId();
  const report = ctx?.setDirty;
  const setDirty = useCallback((value: boolean) => report?.(source, value), [report, source]);

  // A form that unmounts takes its flag with it, whatever it last reported.
  useEffect(() => {
    return () => {
      report?.(source, false);
    };
  }, [report, source]);

  return {
    dirty: ctx?.dirty ?? false,
    setDirty,
    confirmLeave: ctx?.confirmLeave ?? alwaysLeave,
  };
}

/** One line for a form that already computes its own dirty flag: keeps the guard told. */
export function useReportDirty(dirty: boolean): void {
  const { setDirty } = useUnsavedGuard();
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
}

/**
 * For a way out of the page that is not a link (the search window, a keyboard
 * shortcut, a notification, the store switcher): `leave(go)` runs `go` at once
 * when nothing is unsaved, and otherwise asks first and runs it only on
 * "leave". Used from the shell, which sits under the app's own guard.
 */
export function useGuardedLeave(): (go: () => void) => void {
  const ctx = useContext(UnsavedGuardContext);
  const dirty = ctx?.dirty ?? false;
  const confirmLeave = ctx?.confirmLeave;
  return useCallback(
    (go: () => void) => {
      if (!dirty || !confirmLeave) {
        go();
        return;
      }
      void confirmLeave().then((leave) => {
        if (leave) go();
      });
    },
    [dirty, confirmLeave]
  );
}
