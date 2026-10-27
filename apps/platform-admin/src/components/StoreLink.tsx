import { ExternalLink } from "lucide-react";
import { cn } from "@store-builder/ui";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { open: "Open {name} in a new tab" },
  ar: { open: "فتح {name} في تبويب جديد" },
} satisfies Messages;

/** The address shown for a store link: its host, without the scheme. */
function storeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * The link that opens a store (the API's `storeUrl`: its primary domain when
 * that can be served, else its platform subdomain), in a new tab. Nothing when
 * the API sent none, or anything but an http(s) address. It stops the click
 * from reaching a clickable table row around it.
 */
export function StoreLink({ url, name, className }: { url?: string | null; name: string; className?: string }) {
  const t = useT(STRINGS);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={fmt(t.open, { name })}
      title={url}
      className={cn("inline-flex max-w-full items-center gap-1 text-xs text-primary hover:underline", className)}
    >
      <bdi dir="ltr" className="truncate">
        {storeHost(url)}
      </bdi>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}
