"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";

/**
 * Leaves out the store's header and footer on funnel pages (`/f/…`), which draw
 * their own minimal masthead (app/store/[workspaceId]/f/layout.tsx): a funnel
 * keeps the shopper on one path. The store layout sits above the funnel routes
 * and can't know the path on the server, so it asks here which child segment
 * is showing.
 */
export function HideInFunnel({ children }: { children: ReactNode }) {
  return useSelectedLayoutSegment() === "f" ? null : children;
}
