/**
 * The anonymous id the checkout autosave upserts on (the backend wants 8–64
 * chars). One per workspace per browser tab: sessionStorage, so a new tab is a
 * new shopping trip and nothing outlives the session.
 *
 * When storage or crypto.randomUUID is unavailable (private mode, an insecure
 * origin) the id lives in memory for the life of the page instead.
 */

const KEY_PREFIX = "zimos_visitor_";
const memoryIds = new Map<string, string>();

function isValid(id: string | null | undefined): id is string {
  return typeof id === "string" && id.length >= 8 && id.length <= 64;
}

function newId(): string {
  try {
    const id = crypto.randomUUID();
    if (isValid(id)) return id;
  } catch {
    // fall through
  }
  const rand = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return `v${Date.now().toString(36)}${rand()}${rand()}`;
}

export function getVisitorId(workspaceId: string): string {
  const key = `${KEY_PREFIX}${workspaceId}`;
  try {
    const stored = window.sessionStorage.getItem(key);
    if (isValid(stored)) return stored;
    const id = memoryIds.get(key) ?? newId();
    window.sessionStorage.setItem(key, id);
    memoryIds.set(key, id);
    return id;
  } catch {
    let id = memoryIds.get(key);
    if (!id) {
      id = newId();
      memoryIds.set(key, id);
    }
    return id;
  }
}
