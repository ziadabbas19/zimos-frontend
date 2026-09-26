/**
 * Courier and payment gateway logos, looked up by provider code.
 *
 * Every file in src/assets/providers is picked up at build time, so a new
 * provider only needs its file dropped there, named after its code
 * ("mylerz.png", "paymob.svg"). Names are matched ignoring case, "-" and "_",
 * so "JT-Express.png" also serves the code "jtexpress".
 */
const FILES = import.meta.glob<string>("../assets/providers/*.{svg,png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
  query: "?url",
});

const normalize = (value: string) => value.toLowerCase().replace(/[-_\s]/g, "");

const LOGOS: ReadonlyMap<string, string> = new Map(
  Object.entries(FILES).map(([path, url]) => {
    const base = path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
    return [normalize(base), url];
  })
);

/** Display names for codes a screen may show without the provider list at hand. */
const KNOWN_NAMES: Record<string, string> = {
  bosta: "Bosta",
  jtexpress: "J&T Express",
  mylerz: "Mylerz",
  paymob: "Paymob",
  kashier: "Kashier",
};

export function providerName(code: string): string {
  return KNOWN_NAMES[normalize(code)] ?? code;
}

export function providerLogoUrl(code: string): string | undefined {
  return LOGOS.get(normalize(code));
}

/** "J&T Express" → "JE", "Bosta" → "BO". */
export function providerInitials(name: string): string {
  const words = name
    .split(/[\s&_\-.]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toLocaleUpperCase();
}
