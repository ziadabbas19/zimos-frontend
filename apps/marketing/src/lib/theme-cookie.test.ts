import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_COOKIE, themeCookie, themeCookieDomain, writeThemeCookie } from "./theme-cookie";

/**
 * The cookie the dashboard's sign-in screens (app.zimos.co) read the site's
 * light / dark from: on the parent domain in production, on the host alone
 * anywhere else, the theme and nothing more.
 */

const YEAR = 60 * 60 * 24 * 365;

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
});

describe("the theme cookie", () => {
  it("is on .zimos.co for the site and its subdomains, Secure over HTTPS", () => {
    expect(themeCookie("dark", { hostname: "zimos.co", protocol: "https:" })).toBe(
      `zimos-theme=dark; Path=/; Max-Age=${YEAR}; SameSite=Lax; Domain=.zimos.co; Secure`
    );
    expect(themeCookie("light", { hostname: "www.zimos.co", protocol: "https:" })).toBe(
      `zimos-theme=light; Path=/; Max-Age=${YEAR}; SameSite=Lax; Domain=.zimos.co; Secure`
    );
    expect(themeCookieDomain("ZIMOS.CO")).toBe(".zimos.co");
  });

  it("stays on the host anywhere else, and is not Secure over HTTP", () => {
    expect(themeCookie("dark", { hostname: "localhost", protocol: "http:" })).toBe(`zimos-theme=dark; Path=/; Max-Age=${YEAR}; SameSite=Lax`);
    expect(themeCookie("light", { hostname: "marketing-production.up.railway.app", protocol: "https:" })).toBe(
      `zimos-theme=light; Path=/; Max-Age=${YEAR}; SameSite=Lax; Secure`
    );
    for (const host of ["127.0.0.1", "notzimos.co", "zimos.co.example.com", "zimos.com", "co"]) {
      expect(themeCookieDomain(host), host).toBeNull();
    }
  });

  it("is written where the page is (localhost in the tests), readable as the theme alone", () => {
    writeThemeCookie("dark");
    expect(document.cookie).toContain("zimos-theme=dark");
    writeThemeCookie("light");
    expect(document.cookie).toContain("zimos-theme=light");
    expect(document.cookie).not.toContain("zimos-theme=dark");
  });

  it("is skipped quietly where cookies are blocked", () => {
    vi.spyOn(document, "cookie", "set").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => writeThemeCookie("dark")).not.toThrow();
  });
});
