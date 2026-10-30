import { Suspense, type ReactNode } from "react";
import { ZLoader } from "@store-builder/ui";
import { PageLoader } from "@/components/DataState";
import { useCommon } from "@/i18n/LocaleContext";

/**
 * Suspense boundary for a route whose page is code-split with `lazy()`.
 *
 * The dashboard has no app-level Suspense boundary, so a lazy route has to
 * bring its own. Wrapping here rather than in App.tsx keeps the route table
 * to one line per page and gives the chunk fetch the same Z loader a data
 * load gets. `screen`: a page or frame that fills the window (sign-in, the
 * store picker, the dashboard's frame itself) waits on the same full-screen
 * loader the account and the store list show while they load.
 */
function RouteLoader() {
  const common = useCommon();
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <ZLoader label={common.loading} />
    </div>
  );
}

function ScreenLoader() {
  return (
    <div className="min-h-screen bg-paper">
      <PageLoader />
    </div>
  );
}

export function LazyRoute({ children, screen = false }: { children: ReactNode; screen?: boolean }) {
  return (
    <Suspense
      fallback={screen ? <ScreenLoader /> : <RouteLoader />}
    >
      {children}
    </Suspense>
  );
}
