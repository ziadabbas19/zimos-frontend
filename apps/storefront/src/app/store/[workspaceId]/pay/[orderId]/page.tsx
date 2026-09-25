"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { ShopperPaymentStatus, StorefrontPaymentMethod } from "@store-builder/api-client";
import { CheckIcon } from "@/components/Icons";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, container } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { getPaymentToken, paymentPageUrl, usePreviewToken } from "@/lib/payments";
import { useIsClient } from "@/lib/useIsClient";
import { orderErrorMessage } from "@/lib/placeOrder";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";

// While the latest attempt is open, ask again this often, for this long. Each
// ask may make the server check with the gateway (throttled there too).
const POLL_MS = 3000;
const POLL_FOR_MS = 2 * 60 * 1000;

/**
 * Signed fields a gateway puts on the redirect (Paymob: hmac / id; Kashier:
 * signature / paymentStatus); their presence means "just came back". The
 * server works out which gateway signed them.
 */
const GATEWAY_REDIRECT_MARKERS = ["hmac", "id", "signature", "paymentStatus"];

function gatewayQuery(search: URLSearchParams): Record<string, string> | null {
  if (!GATEWAY_REDIRECT_MARKERS.some((key) => search.has(key))) return null;
  const out: Record<string, string> = {};
  search.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * /pay/:orderId — where the gateway sends the shopper back, and where an
 * unpaid online order can be resumed, retried with another method, or turned
 * into cash on delivery. Needs the order's payment token, which only the
 * browser that placed the order holds.
 */
function PaymentPage() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { t, money, locale } = useStore();
  const [client] = useState(() => createStorefrontApiClient());

  // undefined until hydrated; null when this browser holds no token for the order.
  const isClient = useIsClient();
  const token = useMemo(
    () => (isClient ? getPaymentToken(workspaceId, orderId) : undefined),
    [isClient, workspaceId, orderId]
  );
  const [status, setStatus] = useState<ShopperPaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const preview = usePreviewToken(workspaceId);

  const load = useCallback(
    async (refresh: boolean) => {
      if (!token) return;
      try {
        setStatus(await client.getOrderPayment(workspaceId, orderId, token, { refresh, previewToken: preview }));
        setError(null);
      } catch (err) {
        setError(orderErrorMessage(err, t.form.errors));
      }
    },
    [client, workspaceId, orderId, token, preview, t]
  );

  // First load: hand the gateway's redirect to the server (it verifies the
  // signature), then drop it from the address bar.
  useEffect(() => {
    if (!token) return;
    startedAt.current = Date.now();
    const query = gatewayQuery(new URLSearchParams(search.toString()));
    (async () => {
      if (query) {
        try {
          setStatus(await client.returnFromPayment(workspaceId, orderId, token, query, preview));
        } catch (err) {
          setError(orderErrorMessage(err, t.form.errors));
        }
        router.replace(storeHref(basePath, `/pay/${orderId}`));
      } else {
        await load(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep asking while the latest attempt is still open.
  const open = status?.status === "awaiting_payment" && status.attempt?.status === "initialized";
  useEffect(() => {
    if (!open || startedAt.current === null || Date.now() - startedAt.current > POLL_FOR_MS) return;
    const timer = window.setTimeout(() => void load(true), POLL_MS);
    return () => window.clearTimeout(timer);
  }, [open, status, load]);

  async function act(key: string, fn: () => Promise<ShopperPaymentStatus>) {
    setBusy(key);
    setError(null);
    try {
      const next = await fn();
      setStatus(next);
      return next;
    } catch (err) {
      setError(orderErrorMessage(err, t.form.errors));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function retry(method: StorefrontPaymentMethod) {
    if (!token) return;
    const next = await act(method.id, () =>
      client.retryOrderPayment(
        workspaceId,
        orderId,
        token,
        {
          paymentMethod: method.method === "wallet" ? "wallet" : "card",
          ...(method.provider ? { paymentProvider: method.provider } : {}),
          returnUrl: paymentPageUrl(basePath, orderId),
        },
        preview
      )
    );
    const url = next?.attempt?.redirectUrl;
    if (url) {
      setBusy("redirect");
      window.location.assign(url);
    }
  }

  const methodName = (m: StorefrontPaymentMethod) => (m.method === "wallet" ? t.payment.wallet : t.payment.card);
  const thankYou = storeHref(basePath, `/orders/${orderId}?number=${encodeURIComponent(status?.orderNumber ?? "")}`);
  const expiresAt =
    status?.expiresAt &&
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { timeStyle: "short" }).format(new Date(status.expiresAt));

  return (
    <main className={`${container} flex-1 py-10 sm:py-14`}>
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.payment.title}</h1>
        {status && (
          <p className="mt-1 text-sm text-ink-soft">
            {t.payment.orderNumber(status.orderNumber)} · {money(status.totalAmount, status.currency)}
          </p>
        )}

        <section className={`${card} mt-6 p-5 sm:p-6`} aria-live="polite">
          {token === null ? (
            <p className="text-sm text-ink-soft">{t.payment.noToken}</p>
          ) : !status ? (
            <p className="text-sm text-ink-soft">{error ?? t.payment.checking}</p>
          ) : status.status === "paid" ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-lg font-semibold text-success">
                <CheckIcon /> {t.payment.paid}
              </p>
              <p className="text-sm text-ink-soft">{t.payment.paidHint}</p>
              <StoreLink href={`/orders/${orderId}?number=${encodeURIComponent(status.orderNumber)}`} className={btnPrimary}>
                {t.payment.viewOrder}
              </StoreLink>
            </div>
          ) : status.status === "cod" ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-lg font-semibold text-ink">
                <CheckIcon /> {t.payment.codDone}
              </p>
              <p className="text-sm text-ink-soft">{t.payment.codDoneHint}</p>
              <a href={thankYou} className={btnPrimary}>
                {t.payment.viewOrder}
              </a>
            </div>
          ) : status.status === "expired" || status.status === "cancelled" ? (
            <div className="space-y-4">
              <p className="text-lg font-semibold text-ink">
                {status.status === "expired" ? t.payment.expired : t.payment.cancelled}
              </p>
              {status.status === "expired" && <p className="text-sm text-ink-soft">{t.payment.expiredHint}</p>}
              <StoreLink href="/" className={btnSecondary}>
                {t.payment.backToStore}
              </StoreLink>
            </div>
          ) : (
            <div className="space-y-4">
              {status.attempt?.status === "initialized" ? (
                <p className="text-sm text-ink">{t.payment.waiting}</p>
              ) : (
                <div>
                  <p className="text-lg font-semibold text-danger">{t.payment.failed}</p>
                  {status.attempt?.failureReason && (
                    <p className="mt-1 text-sm text-ink-soft">{t.payment.failedReason(status.attempt.failureReason)}</p>
                  )}
                </div>
              )}
              {expiresAt && <p className="text-xs text-ink-soft">{t.payment.expiresAt(expiresAt)}</p>}

              <div className="grid gap-3">
                {status.attempt?.redirectUrl && (
                  <a href={status.attempt.redirectUrl} className={btnPrimary}>
                    {t.payment.resume}
                  </a>
                )}
                {status.canRetry &&
                  status.methods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void retry(m)}
                      className={status.attempt?.redirectUrl ? btnSecondary : btnPrimary}
                    >
                      {busy === m.id || busy === "redirect" ? t.payment.redirecting : t.payment.retryWith(methodName(m))}
                    </button>
                  ))}
                {status.canSwitchToCod && token && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void act("cod", () => client.switchOrderToCod(workspaceId, orderId, token, preview))
                    }
                    className={btnSecondary}
                  >
                    {busy === "cod" ? t.payment.switching : t.payment.switchToCod}
                  </button>
                )}
              </div>
            </div>
          )}
          {error && status && (
            <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-16 text-center text-sm text-ink-soft">…</main>}>
      <PaymentPage />
    </Suspense>
  );
}
