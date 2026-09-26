/**
 * Courier and payment gateway logos, looked up by provider code.
 *
 * Every PNG in src/assets/providers is picked up at build time, so a new
 * provider only needs its file dropped there, named after its code
 * ("mylerz.png"). An optional "<code>.dark.png" is used in the dark theme.
 * Names are matched ignoring case, "-" and "_", so "JT-Express.png" also
 * serves the code "jtexpress".
 */
const FILES = import.meta.glob<string>("../assets/providers/*.png", {
  eager: true,
  import: "default",
  query: "?url",
});

const normalize = (value: string) => value.toLowerCase().replace(/[-_\s]/g, "");

const LIGHT = new Map<string, string>();
const DARK = new Map<string, string>();
for (const [path, url] of Object.entries(FILES)) {
  const base = path.slice(path.lastIndexOf("/") + 1).replace(/\.png$/i, "");
  const dark = /\.dark$/i.test(base);
  (dark ? DARK : LIGHT).set(normalize(dark ? base.slice(0, -5) : base), url);
}

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

/** The logo's URL, and its dark-theme variant when one exists. */
export function providerLogo(code: string): { light: string; dark?: string } | undefined {
  const light = LIGHT.get(normalize(code));
  return light ? { light, dark: DARK.get(normalize(code)) } : undefined;
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
