import { afterEach, describe, expect, it } from "vitest";
import { afterSignInPath, clearPendingInvite, invitePath, isInviteToken, readPendingInvite, rememberPendingInvite } from "./pendingInvite";

const TOKEN = "0f".repeat(32);

// sessionStorage exists in the logic project only through this stand-in.
const store = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
});

afterEach(() => store.clear());

describe("the invite being accepted", () => {
  it("goes back to the invite after signing in, and to the store picker without one", () => {
    expect(afterSignInPath()).toBe("/workspaces");
    rememberPendingInvite({ token: TOKEN, email: "new@zimos.test" });
    expect(readPendingInvite()).toEqual({ token: TOKEN, email: "new@zimos.test" });
    expect(afterSignInPath()).toBe(`/invites?token=${TOKEN}`);
    clearPendingInvite();
    expect(afterSignInPath()).toBe("/workspaces");
  });

  it("ignores anything that is not an invite token", () => {
    store.set("zimos.pendingInvite", JSON.stringify({ token: "../../evil", email: "x@y.z" }));
    expect(readPendingInvite()).toBeNull();
    store.set("zimos.pendingInvite", "not json");
    expect(readPendingInvite()).toBeNull();
    expect(isInviteToken(TOKEN)).toBe(true);
    expect(isInviteToken(TOKEN.toUpperCase())).toBe(false);
    expect(invitePath(TOKEN)).toBe(`/invites?token=${TOKEN}`);
  });
});
