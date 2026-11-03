"use client";

import dynamic from "next/dynamic";

/**
 * The imported templates' (xs) interactive parts — their sliders, product
 * grid, quotes, countdown and forms — each split into its own chunk, the way
 * the immersive ones are (components/immersive/lazy.tsx): a store page that
 * draws none of them downloads none of their code. They still render on the
 * server (next/dynamic's default), so nothing pops in after load.
 */
export const XsSlider = dynamic(() => import("./xs/XsSlider").then((m) => m.XsSlider));
export const XsProductGrid = dynamic(() => import("./xs/XsProductGrid").then((m) => m.XsProductGrid));
export const XsQuotes = dynamic(() => import("./xs/XsQuotes").then((m) => m.XsQuotes));
export const XsCountdown = dynamic(() => import("./xs/XsCountdown").then((m) => m.XsCountdown));
export const XsNewsletterForm = dynamic(() => import("./xs/XsNewsletterForm").then((m) => m.XsNewsletterForm));
export const XsContactForm = dynamic(() => import("./xs/XsContactForm").then((m) => m.XsContactForm));
export const XsStack = dynamic(() => import("./xs/XsStack").then((m) => m.XsStack));
export const XsJourney = dynamic(() => import("./xs/XsJourney").then((m) => m.XsJourney));
export const XsReels = dynamic(() => import("./xs/XsReels").then((m) => m.XsReels));
