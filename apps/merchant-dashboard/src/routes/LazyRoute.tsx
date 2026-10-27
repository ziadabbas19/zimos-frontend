import { Suspense, type ReactNode } from "react";
import { ZLoader } from "@store-builder/ui";
import { useCommon } from "@/i18n/LocaleContext";

/**
 * Suspense boundary for a route whose page is code-split with `lazy()`.
 *
 * The dashboard has no app-level Suspense boundary — every other page is
 * imported eagerly — so a lazy route has to bring its own. Wrapping here
 * rather than in App.tsx keeps the route table to one line per page and gives
 * the chunk fetch the same Z loader a data load gets.
 */
function RouteLoader() {
  const common = useCommon();
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <ZLoader label={common.loading} />
    </div>
  );
}

export function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<RouteLoader />}
    >
      {children}
    </Suspense>
  );
}
