import { describe, expect, it } from "vitest";
import { readSignedIn } from "./site-analytics";

/** The dashboard's sign-in hint (apps/merchant-dashboard/src/lib/signedInHint.ts), as the beacon reads it. */
describe("readSignedIn", () => {
  it("1 is signed in, 0 is not, anything else is unknown", () => {
    expect(readSignedIn("zimos-theme=dark; zimos-signed-in=1")).toBe(true);
    expect(readSignedIn("zimos-signed-in=0")).toBe(false);
    expect(readSignedIn("")).toBeUndefined();
    expect(readSignedIn("zimos-signed-in=yes")).toBeUndefined();
    expect(readSignedIn("not-zimos-signed-in=1")).toBeUndefined();
  });
});
