const MINUTE_MS = 60_000;

/**
 * "Now" for a date range sent to the API: the start of the next minute. The
 * range's `to` is exclusive server-side, so nothing up to now is left out,
 * and every read of the same range within a minute names the same `from`/`to`:
 * one URL, so the browser's kept CORS preflight and the dashboard's shared
 * reads (lib/requestCache) serve it, where a millisecond "now" made a new URL
 * each time.
 */
export function rangeNow(now = Date.now()): number {
  return Math.ceil(now / MINUTE_MS) * MINUTE_MS;
}
