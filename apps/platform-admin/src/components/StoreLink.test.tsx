import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AdminStoreDomain } from "@store-builder/api-client";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { StoreLinks } from "./StoreLink";

/**
 * A store's two addresses in the console: the platform subdomain always, and
 * its own domain under it with a "Custom domain" badge, its state and its
 * certificate. An older API (no platformUrl) keeps the one link it had.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const DOMAIN: AdminStoreDomain = {
  hostname: "www.elmamoun-example.store",
  status: "active",
  sslStatus: "issued",
  primary: true,
  suspended: false,
  state: "connected",
};

function show(workspace: Parameters<typeof StoreLinks>[0]["workspace"]) {
  return render(
    <LocaleProvider>
      <StoreLinks workspace={workspace} />
    </LocaleProvider>
  );
}

const base = {
  name: "Nare",
  storeUrl: "https://naree.zimos.co",
  platformUrl: "https://naree.zimos.co",
  customDomain: null,
  customDomainCount: 0,
};

describe("a store's links", () => {
  it("a store without a domain of its own: the subdomain only, no badge", () => {
    show(base);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://naree.zimos.co");
    expect(links[0].getAttribute("aria-label")).toBe("Open Nare in a new tab");
    expect(links[0].textContent).toBe("naree.zimos.co");
    expect(screen.queryByText("Custom domain")).toBeNull();
  });

  it("a connected domain: the subdomain first, then the domain with its badge, state and certificate", () => {
    show({ ...base, storeUrl: "https://www.elmamoun-example.store", customDomain: DOMAIN, customDomainCount: 1 });
    const [subdomain, custom] = screen.getAllByRole("link");
    expect(subdomain.getAttribute("href")).toBe("https://naree.zimos.co");
    expect(custom.getAttribute("href")).toBe("https://www.elmamoun-example.store");
    expect(custom.getAttribute("aria-label")).toBe("Open Nare on www.elmamoun-example.store in a new tab");
    expect(custom.getAttribute("target")).toBe("_blank");
    expect(custom.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Custom domain")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("SSL issued")).toBeTruthy();
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it("a pending domain: still linked, shown as pending with its certificate not issued", () => {
    show({
      ...base,
      customDomain: { ...DOMAIN, status: "pending_verification", sslStatus: "none", primary: false, state: "pending" },
      customDomainCount: 1,
    });
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "https://naree.zimos.co",
      "https://www.elmamoun-example.store",
    ]);
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("No SSL yet")).toBeTruthy();
    expect(screen.queryByText("Connected")).toBeNull();
  });

  it("a problem or a suspended domain, and how many more the store has", () => {
    const { unmount } = show({ ...base, customDomain: { ...DOMAIN, sslStatus: "moved", state: "problem" }, customDomainCount: 3 });
    expect(screen.getByText("Problem")).toBeTruthy();
    expect(screen.getByText("No longer points here")).toBeTruthy();
    expect(screen.getByText("+2 more")).toBeTruthy();
    unmount();
    show({ ...base, customDomain: { ...DOMAIN, suspended: true, state: "problem" }, customDomainCount: 1 });
    expect(screen.getByText("Suspended")).toBeTruthy();
  });

  it("an older API keeps its one link, and no state badge for a state it does not know", () => {
    const { unmount } = show({ name: "Nare", storeUrl: "https://www.elmamoun-example.store" });
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://www.elmamoun-example.store");
    unmount();
    show({ ...base, customDomain: { ...DOMAIN, state: "unknown" as AdminStoreDomain["state"] }, customDomainCount: 1 });
    expect(screen.getByText("Custom domain")).toBeTruthy();
    expect(screen.queryByText("Connected")).toBeNull();
  });

  it("in Arabic: the badge, the state and the links' names", () => {
    localStorage.setItem("zimos.console.locale", "ar");
    show({ ...base, customDomain: { ...DOMAIN, status: "verified", sslStatus: "pending", state: "pending" }, customDomainCount: 1 });
    expect(screen.getByText("دومين مخصص")).toBeTruthy();
    expect(screen.getByText("في الانتظار")).toBeTruthy();
    expect(screen.getByText("SSL قيد الإصدار")).toBeTruthy();
    expect(screen.getByRole("link", { name: "فتح Nare في تبويب جديد" }).getAttribute("href")).toBe("https://naree.zimos.co");
    expect(screen.getByRole("link", { name: "فتح Nare على www.elmamoun-example.store في تبويب جديد" })).toBeTruthy();
  });
});
