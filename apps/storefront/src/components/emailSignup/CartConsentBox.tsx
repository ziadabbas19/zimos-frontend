"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useStore } from "@/lib/StoreContext";
import { cartChoice, rememberCartChoice, signupCopy, signupPlaces, subscribeCartChoice } from "@/lib/emailSignup";
import { MarketingConsentField } from "../checkout/MarketingConsentField";

/**
 * "Email me offers" in the cart sheet and on the cart page, when the merchant
 * switched the cart's box on and the order form asks for an email. The cart
 * has no address field: the choice travels to the checkout with the cart
 * (this tab), where it is sent with the order — or shown again in the
 * checkout's own box, if that one is on too.
 */
export function CartConsentBox({ className = "mb-3" }: { className?: string }) {
  const { store, locale } = useStore();
  const signup = signupPlaces(store?.emailSignup);
  const preTicked = signup?.cart?.preTicked === true;
  const storeId = store?.id;
  const shown = Boolean(signup?.cart) && store?.checkout?.email !== "hidden";
  // As the shopper left it (this tab); none yet: as the merchant set it. Read after hydration only.
  const remembered = useSyncExternalStore(subscribeCartChoice, () => (storeId ? cartChoice(storeId) : null), () => null);
  const ticked = remembered ?? preTicked;

  // Shown: the checkout learns what the box showed, even if the shopper never touches it.
  useEffect(() => {
    if (shown && storeId && cartChoice(storeId) === null) rememberCartChoice(storeId, preTicked);
  }, [shown, storeId, preTicked]);

  if (!shown || !store) return null;
  return (
    <MarketingConsentField
      checked={ticked}
      onChange={(next) => rememberCartChoice(store.id, next)}
      storeName={store.name}
      locale={locale}
      className={className}
      {...signupCopy(signup, locale)}
    />
  );
}
