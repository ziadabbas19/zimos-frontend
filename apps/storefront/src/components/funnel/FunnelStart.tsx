"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { funnelRuntimeStart } from "@store-builder/api-client";
import { useStoreBasePath } from "@/components/StoreRoute";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { funnelErrorKind } from "@/lib/funnelErrors";
import { funnelVisitorId } from "@/lib/funnelSession";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { FunnelUnavailable } from "./FunnelUnavailable";

/**
 * Enters a funnel. Starting a session needs this browser's visitor id, which
 * only exists client-side, so this runs in the browser: start (or resume) the
 * session, then replace the URL with the session's own address, where the step
 * is rendered on the server. `replace`, so Back doesn't land here again.
 *
 * Every 404 here means the funnel can't be entered (unknown, unpublished, or
 * its entry step is missing), so there is nothing to tell apart.
 */
export function FunnelStart({
  workspaceId,
  funnelRef,
  attribution,
}: {
  workspaceId: string;
  funnelRef: string;
  attribution: Record<string, string>;
}) {
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { t, store } = useStore();
  const [state, setState] = useState<"loading" | "unavailable" | "error">("loading");
  const started = useRef(false);

  const start = useCallback(async () => {
    try {
      const res = await funnelRuntimeStart(createStorefrontApiClient(), workspaceId, funnelRef, {
        // Keyed by the UUID so both ways into the store share one visitor; the
        // slug and the route segment are older keys, migrated once.
        visitorId: store
          ? funnelVisitorId(store.id, [store.slug, workspaceId])
          : funnelVisitorId(workspaceId),
        attribution,
      });
      router.replace(storeHref(basePath, `/f/${res.funnel.id}/${res.session.id}`));
    } catch (err) {
      const kind = funnelErrorKind(err);
      setState(kind === "paused" || kind === "notFound" ? "unavailable" : "error");
    }
  }, [workspaceId, funnelRef, attribution, basePath, router, store]);

  useEffect(() => {
    // Once per mount (Strict Mode runs effects twice); a retry goes through the button.
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  if (state === "unavailable") return <FunnelUnavailable kind="unavailable" />;
  if (state === "error") {
    return (
      <FunnelUnavailable
        kind="error"
        onRetry={() => {
          setState("loading");
          void start();
        }}
      />
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <h1 className="sr-only">{t.funnel.metaTitle}</h1>
      <p role="status" className="flex items-center gap-3 text-sm text-ink-soft">
        <span
          aria-hidden
          className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-primary motion-reduce:animate-none"
        />
        {t.funnel.starting}
      </p>
    </main>
  );
}
