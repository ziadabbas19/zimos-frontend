import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";
import type { ApiClient } from "./client";

/**
 * The API's live updates (backend modules/realtime, REALTIME_ENABLED): one
 * Socket.IO connection, websocket only, at `<api base>/realtime/socket.io`.
 *
 * The server decides what this account hears (its stores' rooms by role, the
 * console's by permission); the client never names a room and sends nothing.
 * Every message carries ids only — the caller fetches what it shows through
 * the API, as it already does.
 *
 * Signing in: the access token goes in the handshake's `auth`, read fresh on
 * every attempt. Before an attempt with a token that is about to expire,
 * `refreshProbe` (any small authenticated GET) lets the client's own 401 →
 * refresh path renew it. The server ends the connection when the token
 * expires or the session ends; this connects again with the renewed token.
 *
 * `onStatus("waiting")` whenever there is no connection: the caller polls in
 * the meantime, and stops once it is "live" again.
 */

export interface RealtimeMessage {
  v: 1;
  /** The event's id (one event, one id, whichever server sent it). */
  id: string | null;
  type: string;
  workspaceId: string | null;
  /** What to fetch again: `{ type: "order", id }`, `{ type: "product", id }`… */
  entity: { type: string; id: string };
  at: string;
}

export type RealtimeStatus = "live" | "waiting";

type SocketFactory = (url: string, options: Partial<ManagerOptions & SocketOptions>) => Socket;

export interface RealtimeOptions {
  client: ApiClient;
  /** The API base the client is built on, absolute or relative: "https://api.example.com/api/v1", "/api/v1". */
  baseUrl: string;
  /** A small authenticated GET, so an expiring access token is renewed before connecting. */
  refreshProbe: () => Promise<unknown>;
  onMessage: (message: RealtimeMessage) => void;
  onStatus?: (status: RealtimeStatus) => void;
  /** Tests pass a fake socket. */
  createSocket?: SocketFactory;
}

export interface RealtimeConnection {
  close: () => void;
  status: () => RealtimeStatus;
}

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
/** A token with less left than this is renewed before an attempt. */
const FRESH_MARGIN_MS = 60_000;

/** Where the socket server is, for an API base: the base's origin, and its path + /realtime/socket.io. */
export function realtimeEndpoint(baseUrl: string, origin: string = globalThis.location?.origin ?? "http://localhost"): { url: string; path: string } {
  const base = new URL(baseUrl.replace(/\/+$/, ""), origin);
  return { url: base.origin, path: `${base.pathname.replace(/\/+$/, "")}/realtime/socket.io` };
}

/** Milliseconds the access token has left; negative when it is missing or unreadable. */
export function tokenLifeMs(token: string | null | undefined, now = Date.now()): number {
  if (!token) return -1;
  try {
    const part = token.split(".")[1];
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 - now : Number.POSITIVE_INFINITY;
  } catch {
    return -1;
  }
}

export function isRealtimeMessage(value: unknown): value is RealtimeMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<RealtimeMessage>;
  return typeof m.type === "string" && !!m.entity && typeof m.entity.type === "string" && typeof m.entity.id === "string";
}

export function connectRealtime(options: RealtimeOptions): RealtimeConnection {
  const { client, refreshProbe, onMessage, onStatus } = options;
  const { url, path } = realtimeEndpoint(options.baseUrl);
  const create: SocketFactory = options.createSocket ?? io;
  let closed = false;
  let current: RealtimeStatus = "waiting";
  let retryMs = RETRY_MIN_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const setStatus = (next: RealtimeStatus) => {
    if (next === current) return;
    current = next;
    onStatus?.(next);
  };

  const socket = create(url, {
    path,
    transports: ["websocket"],
    autoConnect: false,
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
    auth: (cb: (data: object) => void) => cb({ token: client.tokens.accessToken ?? "" }),
  });

  async function start() {
    if (closed) return;
    if (tokenLifeMs(client.tokens.accessToken) < FRESH_MARGIN_MS) {
      try {
        await refreshProbe();
      } catch {
        // Offline or refused: the next attempt asks again.
      }
    }
    if (closed) return;
    // Signed out meanwhile: nothing to connect as.
    if (!client.tokens.accessToken) return;
    socket.connect();
  }

  /** After a refusal or a disconnect the client will not retry by itself: try again later, waiting longer each time. */
  function retryLater() {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(() => void start(), retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  }

  socket.on("connect", () => {
    retryMs = RETRY_MIN_MS;
    setStatus("live");
  });
  socket.on("connect_error", () => {
    if (closed) return;
    setStatus("waiting");
    if (!socket.active) retryLater();
  });
  socket.on("disconnect", () => {
    if (closed) return;
    setStatus("waiting");
    if (!socket.active) retryLater();
  });
  socket.onAny((_name: string, message: unknown) => {
    if (isRealtimeMessage(message)) onMessage(message);
  });

  void start();

  return {
    close() {
      closed = true;
      clearTimeout(timer);
      socket.offAny();
      socket.disconnect();
    },
    status: () => current,
  };
}
