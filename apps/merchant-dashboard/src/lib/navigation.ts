export interface NavItem {
  label: string;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", to: "/" },
  { label: "Orders", to: "/orders" },
  { label: "Confirmation Queue", to: "/confirmation-queue" },
  { label: "Catalog", to: "/catalog" },
  { label: "Customers", to: "/customers" },
  { label: "Discounts", to: "/discounts" },
  { label: "Shipping & Tax", to: "/shipping" },
  { label: "Website", to: "/website" },
  { label: "Funnels", to: "/funnels" },
  { label: "Settings", to: "/settings" },
];
