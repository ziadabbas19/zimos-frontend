/**
 * What a merchant may put in a Video section: a link from a known video host, a
 * direct video file, or the <iframe> code such a host hands out. Only the address
 * is ever read from that code. Nothing the merchant pastes is stored or drawn as
 * markup.
 *
 * The server reads addresses the same way (Backend
 * src/modules/pages/videoEmbed.js): keep the two in step.
 */

export const VIDEO_ASPECTS = ["16:9", "9:16", "1:1", "4:3"] as const;
export type VideoAspect = (typeof VIDEO_ASPECTS)[number];

export type VideoProvider = "youtube" | "vimeo" | "facebook" | "instagram" | "tiktok" | "wistia" | "loom" | "drive" | "file";
export type VideoProblem = "empty" | "unsafe" | "unknown-host" | "short-link" | "unreadable";

export type ParsedVideo =
  | { ok: true; kind: "iframe"; provider: Exclude<VideoProvider, "file">; src: string; id: string; aspect?: VideoAspect }
  | { ok: true; kind: "file"; provider: "file"; src: string; aspect?: VideoAspect }
  | { ok: false; problem: VideoProblem };

const MAX_SOURCE = 4000;
const FILE_PATH = /\.(mp4|webm|m4v)$/i;
const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

/** What each host's player needs from its frame, and nothing more. */
const PLAYER = "allow-scripts allow-same-origin allow-presentation";
const SANDBOX: Record<Exclude<VideoProvider, "file">, string> = {
  youtube: `${PLAYER} allow-popups`,
  vimeo: `${PLAYER} allow-popups`,
  facebook: `${PLAYER} allow-popups`,
  instagram: `${PLAYER} allow-popups`,
  tiktok: `${PLAYER} allow-popups`,
  drive: `${PLAYER} allow-popups`,
  wistia: PLAYER,
  loom: PLAYER,
};

/** The sandbox of a host's frame. */
export function videoSandbox(provider: Exclude<VideoProvider, "file">): string {
  return SANDBOX[provider];
}

/** The picture a host shows before its player loads, where it has one to link to. */
export function videoPoster(video: ParsedVideo): string | null {
  return video.ok && video.kind === "iframe" && video.provider === "youtube" ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null;
}

/** The shape a host's videos have unless the merchant says otherwise. */
export function naturalAspect(video: ParsedVideo): VideoAspect {
  if (!video.ok) return "16:9";
  if (video.aspect) return video.aspect;
  return video.provider === "instagram" || video.provider === "tiktok" ? "9:16" : "16:9";
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (whole, body: string) => {
    if (body[0] !== "#") return ENTITIES[body.toLowerCase()] ?? whole;
    const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

/** The attributes of the first <iframe> tag; null when there is none. */
function iframeAttributes(markup: string): Record<string, string> | null {
  const open = /<iframe(?=[\s/>])/i.exec(markup);
  if (!open) return null;
  const attributes: Record<string, string> = {};
  let at = open.index + open[0].length;
  const char = (index: number) => markup.charAt(index);
  const isSpace = (c: string) => c !== "" && /[\s/]/.test(c);
  while (at < markup.length && char(at) !== ">") {
    if (isSpace(char(at))) {
      at += 1;
      continue;
    }
    const start = at;
    while (at < markup.length && !/[\s/>=]/.test(char(at))) at += 1;
    const name = markup.slice(start, at).toLowerCase();
    while (isSpace(char(at))) at += 1;
    let value = "";
    if (char(at) === "=") {
      at += 1;
      while (char(at) !== "" && /\s/.test(char(at))) at += 1;
      const quote = char(at);
      if (quote === '"' || quote === "'") {
        const end = markup.indexOf(quote, at + 1);
        const stop = end === -1 ? markup.length : end;
        value = markup.slice(at + 1, stop);
        at = stop + 1;
      } else {
        const begin = at;
        while (at < markup.length && !/[\s>]/.test(char(at))) at += 1;
        value = markup.slice(begin, at);
      }
    } else if (start === at) {
      at += 1;
    }
    if (name && !(name in attributes)) attributes[name] = decodeEntities(value);
  }
  return attributes;
}

const fail = (problem: VideoProblem): ParsedVideo => ({ ok: false, problem });
const frame = (provider: Exclude<VideoProvider, "file">, src: string, id: string): ParsedVideo => ({ ok: true, kind: "iframe", provider, src, id });
const segmentsOf = (url: URL) => url.pathname.split("/").filter(Boolean);
const clean = (value: string | null | undefined, pattern: RegExp) => (typeof value === "string" && pattern.test(value) ? value : null);
const hostOf = (url: URL) => url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
const isFacebook = (host: string) => ["facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch"].includes(host);

function youtube(url: URL, host: string): ParsedVideo {
  const parts = segmentsOf(url);
  let raw: string | null | undefined = null;
  if (host === "youtu.be") raw = parts[0];
  else if (parts[0] === "watch") raw = url.searchParams.get("v");
  else if (parts[0] && ["embed", "shorts", "live", "v"].includes(parts[0])) raw = parts[1];
  const id = clean(raw, /^[A-Za-z0-9_-]{6,20}$/);
  if (!id) return fail("unreadable");
  const start = /^(\d{1,6})s?$/.exec(url.searchParams.get("start") ?? url.searchParams.get("t") ?? "");
  return frame("youtube", `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start[1]}` : ""}`, id);
}

function vimeo(url: URL, host: string): ParsedVideo {
  const parts = segmentsOf(url);
  const at = host === "player.vimeo.com" ? (parts[0] === "video" ? 1 : -1) : parts.findIndex((part) => /^\d{6,12}$/.test(part));
  const id = at >= 0 ? clean(parts[at], /^\d{6,12}$/) : null;
  if (!id) return fail("unreadable");
  const hash = clean(url.searchParams.get("h") ?? parts[at + 1], /^[0-9a-f]{6,20}$/i);
  return frame("vimeo", `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}`, id);
}

function facebookFrame(page: string, id: string): ParsedVideo {
  return frame("facebook", `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(page)}&show_text=false`, id);
}

function facebook(url: URL, host: string): ParsedVideo {
  const parts = segmentsOf(url);
  if (host === "fb.watch") {
    const code = clean(parts[0], /^[A-Za-z0-9_-]{4,20}$/);
    return code ? facebookFrame(`https://fb.watch/${code}/`, code) : fail("unreadable");
  }
  if (parts[0] === "plugins") {
    let inner: URL;
    try {
      inner = new URL(url.searchParams.get("href") ?? "");
    } catch {
      return fail("unreadable");
    }
    const innerHost = hostOf(inner);
    if (inner.protocol !== "https:" || parts[1] !== "video.php" || !isFacebook(innerHost) || segmentsOf(inner)[0] === "plugins") return fail("unreadable");
    return facebook(inner, innerHost);
  }
  if (parts[0] === "watch") {
    const id = clean(url.searchParams.get("v"), /^\d{5,20}$/);
    return id ? facebookFrame(`https://www.facebook.com/watch/?v=${id}`, id) : fail("unreadable");
  }
  const marker = parts.findIndex((part) => ["videos", "reel", "v", "r"].includes(part));
  const id = marker >= 0 ? clean(parts[marker + 1], /^[A-Za-z0-9_-]{5,40}$/) : null;
  if (!id) return fail("unreadable");
  const path = parts.slice(0, marker + 2);
  return path.every((part) => /^[\w.-]+$/.test(part)) ? facebookFrame(`https://www.facebook.com/${path.join("/")}/`, id) : fail("unreadable");
}

function instagram(url: URL): ParsedVideo {
  const parts = segmentsOf(url);
  const marker = parts.findIndex((part) => ["reel", "reels", "p", "tv"].includes(part));
  const code = marker >= 0 ? clean(parts[marker + 1], /^[A-Za-z0-9_-]{5,20}$/) : null;
  if (!code) return fail("unreadable");
  return frame("instagram", `https://www.instagram.com/${parts[marker] === "p" ? "p" : "reel"}/${code}/embed/`, code);
}

function tiktok(url: URL, host: string): ParsedVideo {
  const parts = segmentsOf(url);
  if (host !== "tiktok.com" || parts[0] === "t") return fail("short-link");
  const marker = parts.findIndex((part) => ["video", "v1", "v2", "v", "embed"].includes(part));
  const raw = marker >= 0 ? parts.slice(marker + 1).find((part) => /^\d{10,25}(\.html)?$/.test(part)) : null;
  if (!raw) return fail("unreadable");
  const id = raw.replace(".html", "");
  return frame("tiktok", `https://www.tiktok.com/player/v1/${id}`, id);
}

function wistia(url: URL): ParsedVideo {
  const parts = segmentsOf(url);
  const marker = parts.findIndex((part) => part === "medias" || part === "iframe");
  const id = marker >= 0 ? clean((parts[marker + 1] ?? "").replace(/\.(jsonp?|html)$/, ""), /^[a-z0-9]{6,20}$/i) : null;
  return id ? frame("wistia", `https://fast.wistia.net/embed/iframe/${id}`, id) : fail("unreadable");
}

function loom(url: URL): ParsedVideo {
  const parts = segmentsOf(url);
  const id = parts[0] && ["share", "embed"].includes(parts[0]) ? clean(parts[1], /^[A-Za-z0-9]{16,40}$/) : null;
  return id ? frame("loom", `https://www.loom.com/embed/${id}`, id) : fail("unreadable");
}

function drive(url: URL): ParsedVideo {
  const parts = segmentsOf(url);
  const id = clean(parts[0] === "file" && parts[1] === "d" ? parts[2] : url.searchParams.get("id"), /^[A-Za-z0-9_-]{10,80}$/);
  return id ? frame("drive", `https://drive.google.com/file/d/${id}/preview`, id) : fail("unreadable");
}

function providerFor(url: URL, host: string): ParsedVideo | null {
  if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) return youtube(url, host);
  if (host === "vimeo.com" || host === "player.vimeo.com") return vimeo(url, host);
  if (isFacebook(host)) return facebook(url, host);
  if (host === "instagram.com") return instagram(url);
  if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") return tiktok(url, host);
  if (/(^|\.)wistia\.(com|net)$/.test(host)) return wistia(url);
  if (host === "loom.com") return loom(url);
  if (host === "drive.google.com") return drive(url);
  return null;
}

function readAddress(address: string): ParsedVideo {
  // Browsers drop control characters inside an address, so "java\nscript:" is still a script.
  // eslint-disable-next-line no-control-regex
  let value = address.replace(/[\u0000-\u001F\u007F]+/g, "").trim();
  if (value === "") return fail("empty");
  if (/\s/.test(value)) return fail("unreadable");
  if (value.startsWith("//")) value = `https:${value}`;
  if (value.startsWith("/")) {
    return FILE_PATH.test(value.split(/[?#]/)[0] ?? "") ? { ok: true, kind: "file", provider: "file", src: value } : fail("unknown-host");
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("unreadable");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return fail("unsafe");
  if (url.username || url.password) return fail("unsafe");
  const known = url.port ? null : providerFor(url, hostOf(url));
  if (known) return known;
  if (FILE_PATH.test(url.pathname)) {
    url.protocol = "https:";
    return { ok: true, kind: "file", provider: "file", src: url.toString() };
  }
  return fail("unknown-host");
}

/** The nearest offered shape to the width and height written in pasted code. */
function aspectOf(width: string | undefined, height: string | undefined): VideoAspect | undefined {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0 && h > 0)) return undefined;
  const distance = (aspect: VideoAspect) => {
    const [a = 1, b = 1] = aspect.split(":").map(Number);
    return Math.abs(a / b - w / h);
  };
  return [...VIDEO_ASPECTS].sort((x, y) => distance(x) - distance(y))[0];
}

/** Reads a pasted link or <iframe> code into the one address the store may load. */
export function parseVideoSource(input: unknown): ParsedVideo {
  if (typeof input !== "string") return fail("empty");
  const text = input.trim();
  if (text === "") return fail("empty");
  if (text.length > MAX_SOURCE) return fail("unreadable");
  if (!text.includes("<")) return readAddress(decodeEntities(text));
  if (/<\s*script/i.test(text)) return fail("unsafe");
  const attributes = iframeAttributes(text);
  if (!attributes) return fail("unsafe");
  if (!attributes.src) return fail("unreadable");
  const parsed = readAddress(attributes.src);
  if (!parsed.ok) return parsed;
  const aspect = aspectOf(attributes.width, attributes.height);
  return aspect ? { ...parsed, aspect } : parsed;
}
