// The look of the dashboard on this device. The store itself is shared with the
// platform console: packages/ui/src/appearance/store.ts.
import { followSiteTheme } from "./siteTheme";

export * from "@store-builder/ui/appearance";

// Opened on a sign-in screen: the marketing site's light or dark, unless a look was chosen here (lib/siteTheme.ts).
if (typeof window !== "undefined") followSiteTheme(window.location.pathname);
