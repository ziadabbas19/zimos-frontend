import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "@/i18n/provider";
import { SiteHeader } from "./site-header";

/**
 * The logo (components/site-header.tsx): on the home page it goes back to
 * the top itself; from another page it opens the home page at its top, which
 * the home page's header puts right when it mounts.
 */

let pathname = "/en";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

// Next's Link needs the app router; this one is a plain link that keeps what
// the header asks of it and notes whether it would have been followed.
let followed: string[] = [];
vi.mock("next/link", () => ({
  default: ({
    href,
    scroll,
    onClick,
    children,
    ...rest
  }: {
    href: string;
    scroll?: boolean;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    children: ReactNode;
  }) =>
    createElement(
      "a",
      {
        href,
        "data-scroll": String(scroll ?? true),
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
          onClick?.(event);
          if (!event.defaultPrevented) followed.push(href);
          event.preventDefault(); // jsdom can't open another page
        },
        ...rest,
      },
      children,
    ),
}));

const dict = getDictionary("en");
const renderHeader = () =>
  render(createElement(I18nProvider, { value: { locale: "en", dir: "ltr", dict } }, createElement(SiteHeader)));
const logo = () => screen.getByRole("link", { name: dict.nav.homeAria });

beforeEach(() => {
  followed = [];
  sessionStorage.clear();
  localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  // The light/dark switch asks for the system theme, which jsdom doesn't have.
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("the logo", () => {
  it("on the home page: goes back to the top and drops a #section from the address", () => {
    pathname = "/en";
    window.history.replaceState(null, "", "/en#faq");
    renderHeader();
    fireEvent.click(logo());
    expect(followed).toEqual([]); // the link itself is not followed
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(window.location.pathname + window.location.hash).toBe("/en");
  });

  it("from another page: opens the home page without Next's scroll, and keeps its top for it", () => {
    pathname = "/en/pricing";
    renderHeader();
    expect(logo().getAttribute("data-scroll")).toBe("false");
    fireEvent.click(logo());
    expect(followed).toEqual(["/en"]);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem("lz-place") ?? "null")).toMatchObject({ to: "/en", top: true });
  });

  it("a click for a new tab keeps nothing and moves nothing", () => {
    pathname = "/en";
    renderHeader();
    fireEvent.click(logo(), { ctrlKey: true });
    expect(window.scrollTo).not.toHaveBeenCalled();
    pathname = "/en/pricing";
    cleanup();
    renderHeader();
    fireEvent.click(logo(), { metaKey: true });
    expect(sessionStorage.getItem("lz-place")).toBeNull();
  });

  it("the home page opened that way starts at its top", () => {
    sessionStorage.setItem("lz-place", JSON.stringify({ to: "/en", at: Date.now(), top: true }));
    pathname = "/en";
    renderHeader();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
    expect(sessionStorage.getItem("lz-place")).toBeNull();
  });
});

describe("the theme after a language switch", () => {
  it("the dark theme the reader chose is back on the page the switch opened", () => {
    // The switch mounts the other language's <html> attributes: no `dark`.
    document.documentElement.className = "lang-ar";
    localStorage.setItem("theme", "dark");
    pathname = "/ar";
    renderHeader();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.documentElement.classList.contains("lang-ar")).toBe(true);
  });

  it("without a stored choice the system's theme holds", () => {
    document.documentElement.className = "lang-en dark";
    pathname = "/en";
    renderHeader();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("the phone sheet's AR | EN", () => {
  it("keeps the place for the other language only; neither link scrolls", () => {
    pathname = "/en";
    renderHeader();
    const group = screen.getByRole("group", { name: dict.nav.languageLabel, hidden: true });
    const [ar, en] = Array.from(group.querySelectorAll("a"));
    expect([ar.getAttribute("data-scroll"), en.getAttribute("data-scroll")]).toEqual(["false", "false"]);
    fireEvent.click(en);
    expect(sessionStorage.getItem("lz-place")).toBeNull();
    fireEvent.click(ar);
    expect(JSON.parse(sessionStorage.getItem("lz-place") ?? "null")).toMatchObject({ to: "/ar" });
  });
});

describe("the bottom corner", () => {
  it("holds the language switch and the light/dark switch, side by side", () => {
    pathname = "/en/pricing";
    const { container } = renderHeader();
    const corner = container.querySelector(".lz-corner");
    const [first, second] = Array.from(corner?.children ?? []);
    expect(first?.matches("a.lz-lang-pill")).toBe(true);
    expect(first?.getAttribute("href")).toBe("/ar/pricing");
    expect(second?.matches("button.lz-corner__theme")).toBe(true);
    expect(second?.getAttribute("aria-label")).toBe(dict.nav.switchToDark);
  });

  it("the language switch opens the other language without Next's scroll, keeping the place for it", () => {
    pathname = "/en/pricing";
    const { container } = renderHeader();
    const pill = container.querySelector<HTMLAnchorElement>(".lz-corner a.lz-lang-pill")!;
    expect(pill.getAttribute("data-scroll")).toBe("false");
    fireEvent.click(pill);
    expect(followed).toEqual(["/ar/pricing"]);
    expect(JSON.parse(sessionStorage.getItem("lz-place") ?? "null")).toMatchObject({ to: "/ar/pricing" });
  });

  it("steps aside while the footer, which has both switches, is on screen", () => {
    let report: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
    const observed: Element[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof report) {
          report = callback;
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
      },
    );
    const foot = document.body.appendChild(document.createElement("footer"));
    pathname = "/en";
    const { container } = renderHeader();
    const corner = container.querySelector(".lz-corner")!;
    expect(observed).toEqual([foot]);
    expect(corner.classList.contains("is-away")).toBe(false);
    act(() => report([{ isIntersecting: true }]));
    expect(corner.classList.contains("is-away")).toBe(true);
    act(() => report([{ isIntersecting: false }]));
    expect(corner.classList.contains("is-away")).toBe(false);
    foot.remove();
  });

  it("switching the theme there moves nothing", () => {
    pathname = "/en";
    const { container } = renderHeader();
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    fireEvent.click(container.querySelector("button.lz-corner__theme")!);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(scrollBy).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector("button.lz-corner__theme")!);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
