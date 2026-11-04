"use client";

import dynamic from "next/dynamic";

/**
 * The website editor's bridge on a store's own page (EditorViewBridge), split
 * off because the store layout imports it for every visitor while only the
 * editor's frame ever draws it. A client wrapper because next/dynamic only
 * splits from a client module.
 */
export const PreviewBridge = dynamic(() => import("./PreviewBridge").then((m) => m.PreviewBridge));
