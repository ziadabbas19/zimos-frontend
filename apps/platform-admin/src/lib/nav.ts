import {
  Activity,
  Ban,
  Banknote,
  Bell,
  Building2,
  CreditCard,
  Factory,
  Flag,
  Footprints,
  Globe,
  Handshake,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  Palette,
  LifeBuoy,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Puzzle,
  Receipt,
  ScrollText,
  Settings2,
  TicketPercent,
  ShieldAlert,
  Truck,
  Undo2,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { STORE_TRAFFIC_ENABLED } from "@/lib/features";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** The view permission the page's endpoints need; hidden without it. */
  permission: string;
}

export interface NavGroup {
  /** Stable name of the group: what the side menu remembers a folded group by. */
  id: string;
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    label: null,
    items: [
      { label: "Overview", to: "/", icon: LayoutDashboard, permission: P.OVERVIEW_VIEW },
      { label: "Notifications", to: "/notifications", icon: Bell, permission: P.OVERVIEW_VIEW },
      { label: "Site traffic", to: "/site-traffic", icon: Globe, permission: P.OVERVIEW_VIEW },
      // Every store's visitors are store data: workspaces.view (VITE_STORE_TRAFFIC_ENABLED).
      ...(STORE_TRAFFIC_ENABLED ? [{ label: "Store traffic", to: "/store-traffic", icon: Footprints, permission: P.WORKSPACES_VIEW }] : []),
    ],
  },
  {
    id: "merchants",
    label: "Merchants",
    items: [
      { label: "Workspaces", to: "/workspaces", icon: Building2, permission: P.WORKSPACES_VIEW },
      { label: "Users", to: "/users", icon: Users, permission: P.WORKSPACES_VIEW },
      { label: "Subscriptions", to: "/subscriptions", icon: CreditCard, permission: P.SUBSCRIPTIONS_VIEW },
      { label: "Plans", to: "/plans", icon: Layers, permission: P.PLANS_VIEW },
      { label: "Transfer proofs", to: "/payment-proofs", icon: Receipt, permission: P.PAYMENTS_RECORD },
      { label: "Balance refunds", to: "/wallet-refunds", icon: Undo2, permission: P.PAYMENTS_RECORD },
      { label: "Payment methods", to: "/payment-methods", icon: Banknote, permission: P.PAYMENTS_RECORD },
    ],
  },
  {
    id: "referrals",
    label: "Referrals",
    items: [
      { label: "Agents", to: "/agents", icon: Handshake, permission: P.AGENTS_VIEW },
      { label: "Referral codes", to: "/referral-codes", icon: TicketPercent, permission: P.AGENTS_VIEW },
      { label: "My referrals", to: "/my-referrals", icon: Handshake, permission: P.REFERRALS_VIEW_OWN },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    items: [
      { label: "Templates", to: "/templates", icon: LayoutTemplate, permission: P.TEMPLATES_VIEW },
      { label: "Themes", to: "/themes", icon: Palette, permission: P.TEMPLATES_VIEW },
      { label: "Suppliers", to: "/suppliers", icon: Factory, permission: P.TEMPLATES_VIEW },
      { label: "Apps", to: "/apps", icon: Puzzle, permission: P.TEMPLATES_VIEW },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { label: "Carriers", to: "/carriers", icon: Truck, permission: P.PROVIDERS_VIEW },
      { label: "Payment gateways", to: "/payment-gateways", icon: Wallet, permission: P.PROVIDERS_VIEW },
      { label: "WhatsApp numbers", to: "/whatsapp-numbers", icon: MessageCircle, permission: P.PROVIDERS_VIEW },
    ],
  },
  {
    id: "risk",
    label: "Risk",
    items: [
      { label: "Fraud signals", to: "/fraud-signals", icon: ShieldAlert, permission: P.RISK_VIEW },
      { label: "Blocklist (global)", to: "/blocklist", icon: Ban, permission: P.RISK_VIEW },
    ],
  },
  {
    id: "support",
    label: "Support",
    items: [
      { label: "Tickets", to: "/tickets", icon: LifeBuoy, permission: P.SUPPORT_VIEW },
      { label: "Suggestions", to: "/suggestions", icon: Lightbulb, permission: P.SUPPORT_VIEW },
      { label: "Announcements", to: "/announcements", icon: Megaphone, permission: P.ANNOUNCEMENTS_VIEW },
      { label: "Service listings", to: "/service-listings", icon: Handshake, permission: P.SERVICE_LISTINGS_VIEW },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { label: "Feature flags", to: "/feature-flags", icon: Flag, permission: P.FEATURE_FLAGS_VIEW },
      { label: "Audit log", to: "/audit-log", icon: ScrollText, permission: P.AUDIT_LOG_VIEW },
      { label: "System health", to: "/system-health", icon: Activity, permission: P.SYSTEM_VIEW },
      { label: "Admin users", to: "/admin-users", icon: UserCog, permission: P.ADMINS_VIEW },
      { label: "Platform settings", to: "/platform-settings", icon: Settings2, permission: P.PLATFORM_SETTINGS_VIEW },
    ],
  },
];

/** The sidebar as this account sees it: sections it cannot open are left out. */
export function useVisibleNav() {
  const { can } = useAuth();
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => can(item.permission)) })).filter(
    (g) => g.items.length > 0
  );
}

/** The first console page this account can open, in sidebar order. */
export function useLandingPath(): string | null {
  const groups = useVisibleNav();
  return groups[0]?.items[0]?.to ?? null;
}

/**
 * The menu entry a page sits under: its own, or the longest one its address
 * starts with (a workspace's page is under Workspaces). The overview is `/`
 * and nothing else.
 */
export function findNavItem(pathname: string): NavItem | null {
  let found: NavItem | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const under = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
      if (under && (!found || item.to.length > found.to.length)) found = item;
    }
  }
  return found;
}

/** The group an entry is listed in. */
export function findNavGroup(item: NavItem): NavGroup | null {
  return NAV_GROUPS.find((group) => group.items.includes(item)) ?? null;
}
