import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CHECKOUT_SETTINGS_DEFAULTS,
  resolveCheckoutSettings,
  type ApiClient,
  type CheckoutSettings,
} from "@store-builder/api-client";
import type { OrderFormErrors, OrderFormFieldModes } from "./orderForm";
import { useStore } from "./StoreContext";

/**
 * The store's checkout settings, re-read when a client page mounts.
 *
 * The store layout resolves them once, but App Router keeps a layout (and its
 * props) across client-side navigation, so a shopper who has been browsing
 * since before the merchant saved a change would otherwise carry the old
 * settings to checkout. Until the fetch lands — or if it fails — the layout's
 * copy is used.
 */
export function useFreshCheckoutSettings(client: ApiClient, workspaceId: string): CheckoutSettings {
  const { store } = useStore();
  const [fresh, setFresh] = useState<CheckoutSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .getStorefrontMeta(workspaceId)
      .then((meta) => {
        if (!cancelled) setFresh(resolveCheckoutSettings(meta.checkout));
      })
      .catch(() => {
        /* keep the layout's copy */
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  return fresh ?? store?.checkout ?? CHECKOUT_SETTINGS_DEFAULTS;
}

/** Form fields that carry a checkout-settings mode, keyed to the setting. */
const MODE_FIELDS = [
  { field: "email", key: "email", revealAs: "required" },
  { field: "postalCode", key: "postal_code", revealAs: "required" },
  { field: "notes", key: "notes", revealAs: "optional" },
] as const;

/**
 * The field modes a form renders with, plus `reveal()` for when the server
 * names a field the form is hiding — the store changed its settings after the
 * page loaded, or the quick form left out an optional field. The field is
 * shown so the shopper can act on the error instead of being stuck.
 *
 * A hidden field is never sent, so the server can only fault email/postal
 * code for being missing — they come back as required (and are checked as
 * such on the next submit). Notes can't be required; they come back optional.
 */
export function useOrderFormFields(base: OrderFormFieldModes) {
  const [revealed, setRevealed] = useState<Partial<OrderFormFieldModes>>({});

  const fields = useMemo<OrderFormFieldModes>(() => {
    const out = { ...base };
    for (const { key } of MODE_FIELDS) {
      const mode = revealed[key];
      if (mode && out[key] === "hidden") (out as Record<string, string>)[key] = mode;
    }
    return out;
  }, [base, revealed]);

  const reveal = useCallback(
    (errors: OrderFormErrors) => {
      const add: Partial<OrderFormFieldModes> = {};
      for (const { field, key, revealAs } of MODE_FIELDS) {
        if (errors[field] && fields[key] === "hidden") (add as Record<string, string>)[key] = revealAs;
      }
      if (Object.keys(add).length > 0) setRevealed((prev) => ({ ...prev, ...add }));
    },
    [fields]
  );

  return { fields, reveal };
}
