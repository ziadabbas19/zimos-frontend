import { describe, expect, it } from "vitest";
import { signedInCookie } from "./signedInHint";

/**
 * The hint the marketing site's beacon reads (apps/marketing/src/lib/site-analytics.ts):
 * 1 or 0 on .zimos.co and nothing else, never on another host.
 */
describe("signedInCookie", () => {
  it("1 or 0 on .zimos.co, Secure over HTTPS", () => {
    expect(signedInCookie(true, { hostname: "app.zimos.co", protocol: "https:" })).toBe(
      "zimos-signed-in=1; Path=/; Max-Age=2592000; SameSite=Lax; Domain=.zimos.co; Secure"
    );
    expect(signedInCookie(false, { hostname: "zimos.co", protocol: "http:" })).toBe("zimos-signed-in=0; Path=/; Max-Age=2592000; SameSite=Lax; Domain=.zimos.co");
  });

  it("nothing on any other host", () => {
    for (const hostname of ["localhost", "zimos.co.evil.example", "notzimos.co", "store.example.com"]) {
      expect(signedInCookie(true, { hostname, protocol: "https:" })).toBeNull();
    }
  });
});
