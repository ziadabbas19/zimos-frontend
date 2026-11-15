import { describe, expect, it } from "vitest";
import { themeCookie } from "./theme-cookie";
import { themeScript } from "./theme-script";

/**
 * The script in <head>: the theme on <html> before the first paint, as it
 * always was, and the visitor's stored choice copied to the cookie the
 * dashboard's sign-in screens read — the same line the switch writes.
 */

interface Visit {
  stored?: string | null;
  storageBlocked?: boolean;
  deviceDark?: boolean;
  hostname?: string;
  protocol?: string;
}

function visit({ stored = null, storageBlocked = false, deviceDark = false, hostname = "zimos.co", protocol = "https:" }: Visit) {
  const classes = new Set<string>();
  const cookies: string[] = [];
  const documentElement = {
    classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
    style: { colorScheme: "" },
  };
  const document = {
    documentElement,
    set cookie(line: string) {
      cookies.push(line);
    },
  };
  const localStorage = {
    getItem: () => {
      if (storageBlocked) throw new DOMException("blocked", "SecurityError");
      return stored;
    },
  };
  const window = { matchMedia: (query: string) => ({ matches: deviceDark && query === "(prefers-color-scheme: dark)" }) };
  const location = { hostname, protocol };
  new Function("document", "localStorage", "window", "location", themeScript)(document, localStorage, window, location);
  return { dark: classes.has("dark"), scheme: documentElement.style.colorScheme, cookies };
}

describe("the theme before the first paint", () => {
  it("draws the stored choice, else the device's, as before", () => {
    expect(visit({ stored: "dark" })).toMatchObject({ dark: true, scheme: "dark" });
    expect(visit({ stored: "light", deviceDark: true })).toMatchObject({ dark: false, scheme: "light" });
    expect(visit({ deviceDark: true })).toMatchObject({ dark: true, scheme: "dark" });
    expect(visit({})).toMatchObject({ dark: false, scheme: "light" });
    expect(visit({ storageBlocked: true, deviceDark: true })).toMatchObject({ dark: true, scheme: "dark" });
  });

  it("copies a stored choice to the cookie, exactly as the switch writes it", () => {
    for (const where of [
      { hostname: "zimos.co", protocol: "https:" },
      { hostname: "www.zimos.co", protocol: "https:" },
      { hostname: "localhost", protocol: "http:" },
      { hostname: "preview.up.railway.app", protocol: "https:" },
    ]) {
      expect(visit({ stored: "dark", ...where }).cookies, where.hostname).toEqual([themeCookie("dark", where)]);
      expect(visit({ stored: "light", deviceDark: true, ...where }).cookies, where.hostname).toEqual([themeCookie("light", where)]);
    }
  });

  it("writes no cookie without a choice: the dashboard follows the device then", () => {
    expect(visit({ deviceDark: true }).cookies).toEqual([]);
    expect(visit({ stored: "system" }).cookies).toEqual([]);
    expect(visit({ stored: "" }).cookies).toEqual([]);
    expect(visit({ storageBlocked: true }).cookies).toEqual([]);
  });
});
