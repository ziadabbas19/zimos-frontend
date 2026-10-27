import { useCallback, useMemo, useRef, useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { Alert, Button, ZLoader } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Mono, Panel } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import type { SystemHealthReport, SystemService, SystemServiceStatus } from "@/lib/adminApi";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";

/**
 * Worst reading wins, so a single bad service can't be averaged away.
 *
 * `not_configured` services are set aside first rather than ranked: a switched
 * off integration is not a fault, so it must not drag the headline down — and
 * it must not prop it up either. A board whose every tile is switched off has
 * measured nothing, and says so instead of reporting "Operational".
 */
function overallStatus(services: SystemService[]): SystemServiceStatus {
  const probed = services.filter((svc) => svc.status !== "not_configured");
  if (probed.length === 0) return "not_configured";
  for (const s of ["down", "degraded", "unknown"] as const) {
    if (probed.some((svc) => svc.status === s)) return s;
  }
  return "operational";
}

function ServiceTile({ service }: { service: SystemService }) {
  return (
    <Panel
      title={service.name}
      actions={<Status value={service.status} />}
      // Only the browser-side probes know which check they ran. The server
      // reports outcomes, so its tiles carry no line here rather than a
      // plausible-looking one this console invented.
      description={service.description ? <Mono>{service.description}</Mono> : undefined}
    >
      <p className="text-sm text-ink">{service.detail}</p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-soft">
        <div className="flex gap-1.5">
          <dt>Response time</dt>
          <dd className="tabular font-medium text-ink">
            {service.latencyMs === null ? "—" : `${formatNumber(service.latencyMs)} ms`}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Checked</dt>
          <dd className="font-medium text-ink" title={formatDateTime(service.checkedAt)}>
            {formatRelative(service.checkedAt)}
          </dd>
        </div>
        {/* Uptime and incident history only ever render when the server sends
            them. The fallback has no history to draw on, and an invented
            "100%" would be read as a measurement. */}
        {service.uptime30d !== null && (
          <div className="flex gap-1.5">
            <dt>30-day uptime</dt>
            <dd className="tabular font-medium text-ink">
              {(service.uptime30d * 100).toFixed(2)}%
            </dd>
          </div>
        )}
        {service.lastIncidentAt !== null && (
          <div className="flex gap-1.5">
            <dt>Last incident</dt>
            <dd className="font-medium text-ink" title={service.lastIncidentSummary ?? undefined}>
              {formatRelative(service.lastIncidentAt)}
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

/**
 * What the readings on screen actually are — which is not one fixed sentence.
 *
 * A page load takes whatever the server has, which may be a reading it cached
 * moments ago; Re-check forces a fresh probe; and when the endpoint can't be
 * reached at all the numbers come from this browser instead. Stating any one
 * of those unconditionally would be wrong two thirds of the time.
 */
function sourceDescription(report: SystemHealthReport | null): string {
  if (!report) return "Service checks for the platform's dependencies.";
  if (report.source === "probe") {
    return "Checked from your browser just now. Nothing here is cached or recorded.";
  }
  return report.cached
    ? "Probed on the server. These readings came from its cache — Re-check forces a fresh probe."
    : "Probed on the server, just now. Re-check probes again.";
}

export function SystemHealthPage() {
  // `useAsync` re-runs one loader, so the re-check switches which call that
  // loader makes rather than opening a second request path — the stale-call
  // guard and the 401/403 handling stay in one place.
  const forceFresh = useRef(false);
  const { data, loading, error, refresh } = useAsync(() => {
    const fresh = forceFresh.current;
    forceFresh.current = false;
    return fresh ? adminApi.recheckSystemHealth() : adminApi.loadSystemHealth();
  }, []);
  const [rechecking, setRechecking] = useState(false);

  const services = useMemo(() => data?.services ?? [], [data]);
  const overall = useMemo(() => overallStatus(services), [services]);
  const busy = loading || rechecking;

  // A re-check refreshes silently so the current readings stay on screen
  // instead of collapsing to the Z loader — but `useAsync` leaves `loading`
  // false throughout a silent refresh, so the button needs its own busy
  // state. Without it the control looks inert, and an admin who clicks
  // again fires a second round of real third-party probes.
  const recheck = useCallback(async () => {
    forceFresh.current = true;
    setRechecking(true);
    try {
      await refresh({ silent: true });
    } finally {
      setRechecking(false);
    }
  }, [refresh]);

  return (
    <div>
      <PageHeader
        title="System health"
        titleBadge={services.length > 0 ? <Status value={overall} /> : undefined}
        description={sourceDescription(data)}
        actions={
          <Button variant="outline" size="sm" onClick={() => void recheck()} disabled={busy}>
            {busy ? <ZLoader size="sm" /> : <RefreshCw />} {busy ? "Checking…" : "Re-check"}
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-4">
            {data.source === "probe" && (
              <Alert variant="info">
                <Info aria-hidden />
                <span className="font-medium">
                  Per-service reporting isn&rsquo;t available — showing direct probes instead.
                </span>
                <span className="text-ink-soft">
                  <Mono>GET /admin/system/services</Mono> answered:{" "}
                  <span className="text-ink">{data.endpointError}</span> Falling back to the two
                  health endpoints the backend serves at its root, checked from your browser —
                  which covers the API process and its database, and nothing else.
                </span>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {services.map((s) => (
                <ServiceTile key={s.id} service={s} />
              ))}
            </div>

            {data.source === "probe" && (
              <Panel
                title="Not checked"
                description="Dependencies this console currently has no way to observe."
              >
                <ul className="flex flex-wrap gap-2">
                  {adminApi.UNPROBED_DEPENDENCIES.map((d) => (
                    <li
                      key={d}
                      className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink-soft"
                    >
                      {d}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-soft">
                  These are reachable only from the server, so their state is unknown here — treat
                  the tiles above as a partial view, not an all-clear.
                </p>
              </Panel>
            )}

            {services.some((s) => s.status === "not_configured") && (
              <p className="text-xs text-ink-soft">
                <span className="text-ink">Not configured</span> means the integration is switched
                off in this environment, so nothing was probed. It is a statement about the
                deployment, not a fault — read the tile&rsquo;s detail line for which setting turned
                it off.
              </p>
            )}

            {overall === "unknown" && (
              <p className="text-xs text-ink-soft">
                A check that gets no answer is reported as{" "}
                <span className="text-ink">Unknown</span> rather than Down: from the browser, an
                outage and a request blocked before it ever left (CORS, network, an ad-blocker)
                look identical. Confirm from the server before acting on it.
              </p>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}
