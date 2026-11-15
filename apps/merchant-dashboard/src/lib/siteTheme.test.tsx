import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { SiteTheme } from "@/components/SiteTheme";
import { adoptAppearance, keptAppearance, restoreAppearance } from "@/lib/appearance";
import { followSiteTheme, isSiteThemedPath, readSiteTheme, SITE_THEMED_PATHS } from "./siteTheme";

const html = document.documentElement;

/** The device's light / dark. */
function device(dark: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: dark && query.includes("prefers-color-scheme: dark"),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function setCookie(value: string | null) {
  document.cookie = value === null ? "zimos-theme=; Max-Age=0; Path=/" : `zimos-theme=${value}; Path=/`;
}

/** <html> as a page that was never drawn. */
function blankPage() {
  html.classList.remove("dark");
  for (const name of ["data-look", "data-tone", "data-glass"]) html.removeAttribute(name);
  html.style.colorScheme = "";
}

const drawn = () => ({ dark: html.classList.contains("dark"), scheme: html.style.colorScheme, look: html.getAttribute("data-look") });

/** What the dashboard draws when it starts on `path` (lib/appearance.ts at import, then the store). */
function open(path: string) {
  blankPage();
  followSiteTheme(path);
  restoreAppearance();
  return drawn();
}

beforeEach(() => {
  localStorage.clear();
  setCookie(null);
  device(false);
});

afterEach(() => {
  followSiteTheme("/");
  setCookie(null);
  vi.restoreAllMocks();
  blankPage();
});

describe("the cookie", () => {
  it("reads light and dark, wherever it stands among the cookies", () => {
    expect(readSiteTheme("zimos-theme=dark")).toBe("dark");
    expect(readSiteTheme("zimos-theme=light")).toBe("light");
    expect(readSiteTheme("_ga=GA1.1.2; zimos-theme=dark; zimos.locale=ar")).toBe("dark");
    expect(readSiteTheme("a=1;zimos-theme=light")).toBe("light");
  });

  it("ignores any other value, and a cookie of another name", () => {
    for (const cookies of [
      "",
      "zimos-theme=",
      "zimos-theme=Dark",
      "zimos-theme=system",
      'zimos-theme="dark"',
      "zimos-theme=dark%3B",
      "zimos-theme=dark x",
      "zimos-theme=<script>",
      "my-zimos-theme=dark",
      "zimos-themes=dark",
      "theme=dark",
    ]) {
      expect(readSiteTheme(cookies), cookies).toBeNull();
    }
  });

  it("takes the first one when there are two", () => {
    expect(readSiteTheme("zimos-theme=light; zimos-theme=dark")).toBe("light");
    expect(readSiteTheme("zimos-theme=junk; zimos-theme=dark")).toBeNull();
  });
});

describe("the sign-in screens", () => {
  it("are the signed-out screens, as the router matches them", () => {
    for (const path of SITE_THEMED_PATHS) {
      expect(isSiteThemedPath(path), path).toBe(true);
      expect(isSiteThemedPath(`${path}/`), path).toBe(true);
      expect(isSiteThemedPath(path.toUpperCase()), path).toBe(true);
    }
  });

  it("are not the dashboard, nor the steps after signing in", () => {
    for (const path of ["/", "/orders", "/settings", "/choose-username", "/choose-plan", "/workspaces", "/login/x", "/loginx", "/auth", "//login", "/register//"]) {
      expect(isSiteThemedPath(path), path).toBe(false);
    }
  });

  it("are routes of the app", () => {
    const app = readFileSync(join(__dirname, "../App.tsx"), "utf8");
    for (const path of SITE_THEMED_PATHS) expect(app, path).toContain(`<Route path="${path}"`);
  });
});

describe("what a sign-in screen opens in", () => {
  it("the site's theme over the device's", () => {
    setCookie("dark");
    expect(open("/login")).toEqual({ dark: true, scheme: "dark", look: "dark" });

    device(true);
    setCookie("light");
    expect(open("/register")).toEqual({ dark: false, scheme: "light", look: "light" });
  });

  it("the dark look chosen last, for a dark site", () => {
    localStorage.setItem("zimos.darkLook", "black");
    setCookie("dark");
    expect(open("/login")).toMatchObject({ dark: true, look: "black" });
  });

  it("a look chosen in the dashboard over the site's", () => {
    setCookie("dark");
    localStorage.setItem("zimos.look", "light");
    expect(open("/login")).toMatchObject({ dark: false, look: "light" });

    setCookie("light");
    localStorage.setItem("zimos.look", "black");
    expect(open("/register")).toMatchObject({ dark: true, look: "black" });

    // A choice from before the three looks counts as one.
    localStorage.clear();
    localStorage.setItem("theme", "dark");
    expect(open("/login")).toMatchObject({ dark: true, look: "dark" });
  });

  it("the device's, with no cookie or one that holds anything else", () => {
    expect(open("/login")).toMatchObject({ dark: false, look: "light" });
    device(true);
    expect(open("/login")).toMatchObject({ dark: true, look: "dark" });

    document.cookie = "zimos-theme=sepia; Path=/";
    expect(open("/login")).toMatchObject({ dark: true, look: "dark" });
    device(false);
    expect(open("/login")).toMatchObject({ dark: false, look: "light" });
  });

  it("keeps nothing of it, here or for the account", () => {
    setCookie("dark");
    open("/login");
    expect(keptAppearance().look).toBeNull();
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it("gives way to the account's look when one is taken", () => {
    setCookie("dark");
    expect(open("/login")).toMatchObject({ dark: true });
    act(() => adoptAppearance({ ...keptAppearance(), look: "light" }));
    expect(drawn()).toMatchObject({ dark: false, look: "light" });
  });
});

describe("the rest of the dashboard", () => {
  it("does not read the cookie", () => {
    setCookie("dark");
    expect(open("/")).toMatchObject({ dark: false, look: "light" });
    expect(open("/orders")).toMatchObject({ dark: false, look: "light" });
    expect(open("/workspaces")).toMatchObject({ dark: false, look: "light" });
  });

  it("goes back to its own look on the way out of a sign-in screen", () => {
    setCookie("dark");
    expect(open("/login")).toMatchObject({ dark: true });
    followSiteTheme("/");
    expect(drawn()).toMatchObject({ dark: false, look: "light" });
  });
});

describe("<SiteTheme />, moving between pages", () => {
  function Go({ to }: { to: string }) {
    const navigate = useNavigate();
    return (
      <button type="button" onClick={() => navigate(to)}>
        {to}
      </button>
    );
  }

  it("takes the site's theme on a sign-in screen and lets go of it after", () => {
    setCookie("dark");
    blankPage();
    restoreAppearance();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SiteTheme />
        <Routes>
          <Route path="/" element={<Go to="/login" />} />
          <Route path="/login" element={<Go to="/register" />} />
          <Route path="/register" element={<Go to="/orders" />} />
          <Route path="/orders" element={<span>orders</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(drawn()).toMatchObject({ dark: false });

    act(() => screen.getByRole("button", { name: "/login" }).click());
    expect(drawn()).toMatchObject({ dark: true, look: "dark" });

    act(() => screen.getByRole("button", { name: "/register" }).click());
    expect(drawn()).toMatchObject({ dark: true, look: "dark" });

    act(() => screen.getByRole("button", { name: "/orders" }).click());
    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(drawn()).toMatchObject({ dark: false, look: "light" });
  });
});

describe("before the first paint", () => {
  // The script the page runs in <head>, as it is in index.html.
  const page = readFileSync(join(__dirname, "../../index.html"), "utf8");
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)?.[1] ?? "";

  it("draws what the app draws after it, for every screen, cookie, choice and device", () => {
    const paths = [...SITE_THEMED_PATHS, "/LOGIN", "/register/", "/", "/orders", "/choose-plan", "/workspaces", "/login/x", "/loginx"];
    const cookies = [null, "light", "dark", "sepia", ""];
    const stored: Record<string, string>[] = [{}, { "zimos.look": "light" }, { "zimos.look": "black" }, { theme: "dark" }, { "zimos.darkLook": "black" }];
    let compared = 0;
    for (const path of paths) {
      window.history.replaceState(null, "", path);
      for (const cookie of cookies) {
        for (const storage of stored) {
          for (const dark of [false, true]) {
            localStorage.clear();
            for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
            setCookie(cookie);
            device(dark);

            blankPage();
            new Function(script)();
            const byThePage = drawn();

            expect(open(path), JSON.stringify({ path, cookie, storage, dark })).toEqual(byThePage);
            followSiteTheme("/");
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBe(paths.length * cookies.length * stored.length * 2);
    window.history.replaceState(null, "", "/");
  });

  it("opens a sign-in screen dark from the cookie while the device is light", () => {
    window.history.replaceState(null, "", "/register");
    setCookie("dark");
    blankPage();
    new Function(script)();
    expect(drawn()).toEqual({ dark: true, scheme: "dark", look: "dark" });
    window.history.replaceState(null, "", "/");
  });
});
