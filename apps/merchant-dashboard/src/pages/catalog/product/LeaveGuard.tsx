import type { MouseEvent, ReactNode } from "react";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { useViewNavigate } from "@/lib/viewTransition";

/**
 * Asks before a link inside the product page takes the merchant away from
 * unsaved edits (the way back to the list, a link to another product, to the
 * size charts…). The app has no route blockers, so the question is asked at
 * the click: while anything on the page is unsaved, a plain click on an
 * in-app link waits for the answer of the guard's dialog. Links that open a
 * new tab, links to another site and in-page `#links` pass untouched. The
 * side menu and the dock are outside the page: the app's own guard
 * (`UnsavedGuardProvider` in App.tsx) asks for those, and when it is mounted
 * it answers for the links in here too, before this one sees the click.
 *
 * Must sit inside `UnsavedGuardProvider`.
 */
export function LeaveGuard({ children, className }: { children: ReactNode; className?: string }) {
  const { dirty, confirmLeave } = useUnsavedGuard();
  const navigate = useViewNavigate();

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!dirty || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>("a[href]");
    if (!link || !event.currentTarget.contains(link)) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    let url: URL;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    // The same page: a section link, or a link that only changes the query of this product.
    if (url.pathname === window.location.pathname) return;

    event.preventDefault();
    event.stopPropagation();
    void confirmLeave().then((leave) => {
      if (leave) navigate(`${url.pathname}${url.search}${url.hash}`);
    });
  }

  return (
    <div className={className} onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
