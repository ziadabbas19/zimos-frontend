import { ExternalLink } from "lucide-react";
import type { AdminStoreDomainState, AdminWorkspaceOverview } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { StatusBadge, type Tone } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    open: "Open {name} in a new tab",
    openDomain: "Open {name} on {host} in a new tab",
    customDomain: "Custom domain",
    connected: "Connected",
    pending: "Pending",
    problem: "Problem",
    suspended: "Suspended",
    ssl_none: "No SSL yet",
    ssl_pending: "SSL pending",
    ssl_issued: "SSL issued",
    ssl_failed: "SSL failed",
    ssl_moved: "No longer points here",
    more: "+{count} more",
  },
  ar: {
    open: "فتح {name} في تبويب جديد",
    openDomain: "فتح {name} على {host} في تبويب جديد",
    customDomain: "دومين مخصص",
    connected: "متصل",
    pending: "في الانتظار",
    problem: "به مشكلة",
    suspended: "موقوف",
    ssl_none: "بلا SSL بعد",
    ssl_pending: "SSL قيد الإصدار",
    ssl_issued: "SSL صادرة",
    ssl_failed: "فشل SSL",
    ssl_moved: "لم يعد يشير إلى المتجر",
    more: "+{count} أخرى",
  },
} satisfies Messages;

const STATE_TONE: Record<AdminStoreDomainState, Tone> = {
  connected: "success",
  pending: "warning",
  problem: "danger",
};

const SSL_KEYS = {
  none: "ssl_none",
  pending: "ssl_pending",
  issued: "ssl_issued",
  failed: "ssl_failed",
  moved: "ssl_moved",
} as const;

const isState = (value: unknown): value is AdminStoreDomainState =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(STATE_TONE, value);

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
export function StoreLink({ url, name, label, className }: { url?: string | null; name: string; label?: string; className?: string }) {
  const t = useT(STRINGS);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={label ?? fmt(t.open, { name })}
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

type StoreLinksWorkspace = Pick<AdminWorkspaceOverview, "name" | "storeUrl" | "platformUrl" | "customDomain" | "customDomainCount">;

/**
 * Both addresses of a store: its platform subdomain always, and under it its
 * own domain with a "Custom domain" badge, its state and its certificate. An
 * older API (no `platformUrl`) gets the one `storeUrl` link, as before. Long
 * hosts are cut with an ellipsis by the width of whatever holds this.
 */
export function StoreLinks({ workspace, className }: { workspace: StoreLinksWorkspace; className?: string }) {
  const t = useT(STRINGS);
  if (workspace.platformUrl === undefined) return <StoreLink url={workspace.storeUrl} name={workspace.name} className={className} />;

  const domain = workspace.customDomain;
  const state = domain && isState(domain.state) ? domain.state : null;
  const sslKey = domain ? SSL_KEYS[domain.sslStatus as keyof typeof SSL_KEYS] : undefined;
  const more = Math.max(0, (workspace.customDomainCount ?? 0) - 1);

  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-1", className)}>
      <StoreLink url={workspace.platformUrl} name={workspace.name} />
      {domain && (
        <>
          <StoreLink
            url={`https://${domain.hostname}`}
            name={workspace.name}
            label={fmt(t.openDomain, { name: workspace.name, host: domain.hostname })}
          />
          <div className="flex max-w-full flex-wrap items-center gap-1">
            <StatusBadge tone="neutral" className="px-1.5 py-0 text-[11px]">
              {t.customDomain}
            </StatusBadge>
            {state && (
              <StatusBadge tone={STATE_TONE[state]} dot className="px-1.5 py-0 text-[11px]">
                {domain.suspended ? t.suspended : t[state]}
              </StatusBadge>
            )}
            {sslKey && <span className="text-[11px] whitespace-nowrap text-ink-soft">{t[sslKey]}</span>}
            {more > 0 && <span className="text-[11px] whitespace-nowrap text-ink-soft">{fmt(t.more, { count: more })}</span>}
          </div>
        </>
      )}
    </div>
  );
}
