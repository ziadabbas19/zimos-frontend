"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useCart } from "@/lib/CartProvider";

/**
 * Parts of the store's frame (app/store/[workspaceId]/layout.tsx) that draw
 * nothing until they are asked to: the cart drawer stays closed until "add to
 * cart", and the newsletter band, the exit popup and the sales notifications
 * draw nothing until their settings have been fetched in the browser. The
 * server's HTML has none of them either way, so they are not part of what a
 * page needs to hydrate: their code comes right after, in chunks of its own.
 * A client wrapper because next/dynamic only splits from a client module.
 */
const Drawer = dynamic(() => import("./CartDrawer").then((m) => m.CartDrawer), { ssr: false });

/** A visitor who has put nothing in the cart never downloads the drawer. */
export function CartDrawer() {
  const { itemCount, isDrawerOpen, isAdding } = useCart();
  const [wanted, setWanted] = useState(false);
  if (!wanted && (itemCount > 0 || isDrawerOpen || isAdding)) setWanted(true);
  return wanted ? <Drawer /> : null;
}

export const ExitDownsell = dynamic(() => import("./offers/StoreOffers").then((m) => m.ExitDownsell), { ssr: false });
export const NewsletterSignup = dynamic(() => import("./offers/Engagement").then((m) => m.NewsletterSignup), { ssr: false });
export const SocialProofPopup = dynamic(() => import("./offers/Engagement").then((m) => m.SocialProofPopup), { ssr: false });
