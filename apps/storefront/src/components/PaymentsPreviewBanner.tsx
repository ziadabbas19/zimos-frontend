"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/StoreContext";
import { setPreviewToken, usePreviewToken } from "@/lib/payments";

/**
 * The merchant's "Test checkout in store preview" link opens the store with
 * `?paymentsPreview=<token>`. The token is kept for this tab (sessionStorage),
 * sent with the checkout calls so test-mode payment methods appear, and taken
 * out of the address bar so a copied link never carries it. While it is set,
 * this banner says so on every page. The server checks the token on every
 * call; nothing here grants anything by itself.
 */
export function PaymentsPreviewBanner({ workspaceId }: { workspaceId: string }) {
  const { t } = useStore();
  const active = Boolean(usePreviewToken(workspaceId));

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("paymentsPreview");
    if (fromUrl) {
      setPreviewToken(workspaceId, fromUrl);
      url.searchParams.delete("paymentsPreview");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [workspaceId]);

  if (!active) return null;

  function leave() {
    setPreviewToken(workspaceId, null);
    window.location.reload();
  }

  return (
    <div role="status" className="border-b border-accent/40 bg-accent-soft px-4 py-2 text-center text-sm text-accent-dark">
      {t.payment.testBanner}{" "}
      <button type="button" onClick={leave} className="min-h-11 cursor-pointer font-semibold underline">
        {t.payment.testBannerExit}
      </button>
    </div>
  );
}
