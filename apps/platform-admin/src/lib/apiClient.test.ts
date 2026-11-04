import { afterEach, describe, expect, it, vi } from "vitest";
import { FORBIDDEN_EVENT, apiClient } from "./apiClient";

/** A refused request tells the console to read the account again (context/AuthContext.tsx). */

function answerWith(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: { code: "X", message: "no" } }), { status, headers: { "content-type": "application/json" } }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the console's API client", () => {
  it("announces a 403, and still rejects the call", async () => {
    answerWith(403);
    const heard = vi.fn();
    window.addEventListener(FORBIDDEN_EVENT, heard);
    await expect(apiClient.request("/admin/plans")).rejects.toMatchObject({ status: 403 });
    window.removeEventListener(FORBIDDEN_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("says nothing on any other failure", async () => {
    answerWith(404);
    const heard = vi.fn();
    window.addEventListener(FORBIDDEN_EVENT, heard);
    await expect(apiClient.request("/admin/plans")).rejects.toMatchObject({ status: 404 });
    window.removeEventListener(FORBIDDEN_EVENT, heard);
    expect(heard).not.toHaveBeenCalled();
  });
});
