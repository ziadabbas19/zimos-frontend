import { notFound } from "next/navigation";
import { brandStyle, getStoreMeta } from "@/lib/storeMeta";

/**
 * Wraps every page of one store. Its only job is to establish the merchant's
 * brand colours once, as CSS custom properties, so the whole subtree (header,
 * buttons, links, badges) picks them up through the semantic tokens — see the
 * `.brand-theme` block in globals.css.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  if (!store) notFound();

  return (
    <div className="brand-theme flex min-h-full flex-1 flex-col" style={brandStyle(store.themeSettings)}>
      {children}
    </div>
  );
}
