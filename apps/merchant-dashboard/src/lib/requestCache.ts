/**
 * The GETs of the dashboard, shared (lib/apiClient sends every request through
 * here):
 *
 *   - the same GET asked twice while the first is on its way is one request:
 *     the second waits for the first's answer (the access banner and the
 *     store link, the side menu and home, ask for the same thing at once);
 *   - an answer handed out before it is asked for (`prime`, the bootstrap in
 *     lib/bootstrap) answers the first reads of that path when they come, and
 *     a read that comes while the bootstrap is still on its way waits for it
 *     (`coverWhile`) instead of asking the server a second time;
 *   - the store's access, which the banner reads again on every page, is kept
 *     for STALE_MS: moving between pages does not ask for it each time;
 *   - any other request (a save, a sign-in, a sign-out) forgets everything
 *     kept, before it is sent and once it is answered: whatever is read after
 *     a change comes from the server.
 *
 * Every caller gets its own copy of an answer. A request with an AbortSignal
 * or headers of its own is never shared.
 */

/** How long a primed answer waits for its first read. */
export const PRIMED_MS = 15_000;
/** After its first read, a primed answer still serves the reads of the same burst (the frame mounting), then it is gone. */
export const BURST_MS = 1_000;
/** How long a read on the STALE list is reused. */
export const STALE_MS = 30_000;

/** Paths whose answer is reused for STALE_MS: read again on every page, changed only by a save here (which forgets it) or rarely elsewhere. */
const STALE: RegExp[] = [/^\/workspaces\/[^/?]+\/access$/];

interface Kept {
  body: unknown;
  expiresAt: number;
  /** A primed answer: gone BURST_MS after its first read. */
  burst: boolean;
  firstReadAt: number | null;
}

const kept = new Map<string, Kept>();
const inFlight = new Map<string, Promise<unknown>>();
let cover: { paths: Set<string>; until: Promise<unknown> } | null = null;

const now = () => Date.now();

function copy<T>(value: T): T {
  return value === undefined || value === null ? value : structuredClone(value);
}

function take(path: string): { hit: true; body: unknown } | { hit: false } {
  const entry = kept.get(path);
  if (!entry) return { hit: false };
  const t = now();
  if (t >= entry.expiresAt || (entry.burst && entry.firstReadAt !== null && t - entry.firstReadAt > BURST_MS)) {
    kept.delete(path);
    return { hit: false };
  }
  if (entry.burst && entry.firstReadAt === null) entry.firstReadAt = t;
  return { hit: true, body: copy(entry.body) };
}

function staleFor(path: string): boolean {
  return STALE.some((pattern) => pattern.test(path));
}

/** Keeps `body` as the answer to a GET of `path` for `ttlMs`, until its first read's burst is over. */
export function prime(path: string, body: unknown, ttlMs = PRIMED_MS): void {
  kept.set(path, { body: copy(body), expiresAt: now() + ttlMs, burst: true, firstReadAt: null });
}

/** A read of one of `paths` that comes before `until` settles waits for it, then looks for a primed answer. */
export function coverWhile(paths: Iterable<string>, until: Promise<unknown>): void {
  const entry = { paths: new Set(paths), until: until.catch(() => undefined) };
  cover = entry;
  void entry.until.then(() => {
    if (cover === entry) cover = null;
  });
}

/** Forgets every kept answer and every shared request in flight. */
export function forgetAll(): void {
  kept.clear();
  inFlight.clear();
}

/**
 * Sends a GET of `path` through `send`, sharing it as described above. `send`
 * makes the request itself; it is called at most once per shared request.
 */
export async function sharedGet<T>(path: string, send: () => Promise<T>): Promise<T> {
  const first = take(path);
  if (first.hit) return first.body as T;

  const waiting = cover;
  if (waiting && waiting.paths.has(path)) {
    await waiting.until;
    const primed = take(path);
    if (primed.hit) return primed.body as T;
  }

  const shared = inFlight.get(path);
  if (shared) return copy((await shared) as T);

  const request = send();
  inFlight.set(path, request);
  try {
    const body = await request;
    if (inFlight.get(path) === request && staleFor(path)) {
      kept.set(path, { body: copy(body), expiresAt: now() + STALE_MS, burst: false, firstReadAt: null });
    }
    return body;
  } finally {
    if (inFlight.get(path) === request) inFlight.delete(path);
  }
}

/** Test seam: forget everything, the cover too. */
export function resetRequestCache(): void {
  forgetAll();
  cover = null;
}
