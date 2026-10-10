import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Link, Route, Routes, useNavigate } from "react-router-dom";
import { LocaleProvider, type Locale } from "@/i18n/LocaleContext";
import { ToastProvider } from "@/components/Toast";
import { fakeBackend } from "@/test/fakeBackend";
import { LocationProbe } from "@/test/LocationProbe";
import { testWorkspace, workspaceMock } from "@/test/mocks";
import { OrderRulesPage } from "@/pages/offers/OrderRulesPage";
import { ProfitCostsPage } from "@/pages/profit/ProfitCostsPage";
import { StoreDesignPage } from "@/pages/storeDesign/StoreDesignPage";
import { UnsavedGuardProvider, useGuardedLeave, useReportDirty } from "./useUnsavedGuard";

/**
 * Leaving a page that holds unsaved changes. The pages are rendered the way
 * App.tsx renders them: a plain BrowserRouter, the language, the toasts, ONE
 * leave guard around the routes, and the side menu's links outside the page.
 */

/** A way out that is not a link, as the search window and the keyboard shortcuts are. */
function SearchResult() {
  const navigate = useNavigate();
  const leave = useGuardedLeave();
  return (
    <button type="button" onClick={() => leave(() => navigate("/orders"))}>
      Go to orders
    </button>
  );
}

function renderApp(route: string, pages: ReactElement, locale: Locale = "en") {
  localStorage.setItem("zimos.locale", locale);
  window.history.pushState({}, "", route);
  const user = userEvent.setup();
  render(
    <BrowserRouter>
      <LocaleProvider>
        <ToastProvider>
          <UnsavedGuardProvider>
            <nav aria-label="Side menu">
              <Link to="/orders">Orders</Link>
              <Link to="/orders" target="_blank">
                Orders in a new tab
              </Link>
              <a href="https://help.example.com/guide">Help centre</a>
              <Link to={`${route.split("?")[0]}?tab=other`}>Another tab of this page</Link>
              <SearchResult />
            </nav>
            <Routes>
              {pages}
              <Route path="/orders" element={<h1>Orders list</h1>} />
            </Routes>
            <LocationProbe />
          </UnsavedGuardProvider>
        </ToastProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
  return user;
}

const path = () => screen.getByTestId("location").textContent ?? "";
const question = () => screen.queryByRole("dialog", { name: "Discard changes?" });
const sideLink = (name: string) => within(screen.getByRole("navigation", { name: "Side menu" })).getByRole("link", { name });

/** What the browser does on a reload or a closed tab: true when the page asked it to warn first. */
function browserWouldWarn(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

const costs = { packagingCostAmount: 500, shippingCostAmount: 4000, returnCostAmount: 2500, collectionFeeBp: 100, gatewayFeeBp: 250, damageBp: 0 };
const costsRoute = <Route path="/profit/costs" element={<ProfitCostsPage />} />;

function serveCosts() {
  // What the server holds: a save changes it, and the next read returns it.
  let stored = costs;
  return fakeBackend({
    "GET /profit/economics": () => ({ defaults: stored, products: [] }),
    "PUT /profit/economics/defaults": ({ body }: { body?: unknown }) => {
      stored = { ...stored, ...(body as object) };
      return { defaults: stored };
    },
  });
}

async function changeCourierCharge(user: ReturnType<typeof userEvent.setup>) {
  const field = await screen.findByLabelText("Courier charge per order");
  await user.clear(field);
  await user.type(field, "55");
  return field as HTMLInputElement;
}

beforeEach(() => {
  Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, role: "owner", settings: {} } });
});

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("a side-menu link, with unsaved changes on the page", () => {
  it("asks first on the costs page; Keep editing stays with what was typed, Discard leaves", async () => {
    serveCosts();
    const user = renderApp("/profit/costs", costsRoute);
    const field = await changeCourierCharge(user);

    await user.click(sideLink("Orders"));
    const dialog = await screen.findByRole("dialog", { name: "Discard changes?" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(path()).toBe("/profit/costs");

    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(question()).not.toBeInTheDocument());
    expect(path()).toBe("/profit/costs");
    expect(field.value).toBe("55");

    await user.click(sideLink("Orders"));
    await user.click(within(await screen.findByRole("dialog", { name: "Discard changes?" })).getByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("heading", { name: "Orders list" })).toBeInTheDocument();
    expect(path()).toBe("/orders");
    expect(window.location.pathname).toBe("/orders");
  });

  it("goes at once when nothing was changed, and again once the change is saved or dropped", async () => {
    const calls = serveCosts();
    const user = renderApp("/profit/costs", costsRoute);
    await changeCourierCharge(user);
    await user.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument());

    await user.click(sideLink("Orders"));
    expect(await screen.findByRole("heading", { name: "Orders list" })).toBeInTheDocument();
    expect(question()).not.toBeInTheDocument();
  });

  it("asks on a store settings section too", async () => {
    fakeBackend({});
    const user = renderApp("/store-settings/seo", <Route path="/store-settings/:tab" element={<StoreDesignPage />} />);
    await user.type(await screen.findByLabelText("Page title template"), "%s | Nile");

    await user.click(sideLink("Orders"));
    const dialog = await screen.findByRole("dialog", { name: "Discard changes?" });
    expect(path()).toBe("/store-settings/seo");

    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect((screen.getByLabelText("Page title template") as HTMLInputElement).value).toBe("%s | Nile");

    await user.click(sideLink("Orders"));
    await user.click(within(await screen.findByRole("dialog", { name: "Discard changes?" })).getByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("heading", { name: "Orders list" })).toBeInTheDocument();
  });

  it("asks on a page that only has the save bar (an offers page)", async () => {
    fakeBackend({ "GET /offers/order-rules": { orderRules: { minOrderAmount: 5000 } } });
    const user = renderApp("/offers/order-rules", <Route path="/offers/order-rules" element={<OrderRulesPage />} />);
    const field = await screen.findByLabelText("Minimum order amount");
    await user.clear(field);
    await user.type(field, "90");

    await user.click(sideLink("Orders"));
    expect(await screen.findByRole("dialog", { name: "Discard changes?" })).toBeInTheDocument();
    expect(path()).toBe("/offers/order-rules");
  });

  it("asks in the dashboard's own Arabic", async () => {
    serveCosts();
    const user = renderApp("/profit/costs", costsRoute, "ar");
    const field = await screen.findByDisplayValue(/^40(\.00)?$/);
    await user.clear(field);
    await user.type(field, "55");

    await user.click(sideLink("Orders"));
    const dialog = await screen.findByRole("dialog", { name: "هل تريد ترك التعديلات؟" });
    expect(within(dialog).getByRole("button", { name: "مواصلة التعديل" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "ترك التعديلات" })).toBeInTheDocument();
  });
});

describe("a way out that is not a link (search, a shortcut, a notification)", () => {
  it("asks first while something is unsaved, and goes at once otherwise", async () => {
    serveCosts();
    const user = renderApp("/profit/costs", costsRoute);
    await changeCourierCharge(user);

    await user.click(screen.getByRole("button", { name: "Go to orders" }));
    const dialog = await screen.findByRole("dialog", { name: "Discard changes?" });
    expect(path()).toBe("/profit/costs");
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(question()).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Discard" }));
    await user.click(screen.getByRole("button", { name: "Go to orders" }));
    // Nothing unsaved: no question, and no wait either.
    expect(path()).toBe("/orders");
  });
});

describe("clicks that do not take the page away", () => {
  it("lets a new tab, another site, a modified click and a link of the same page through", async () => {
    serveCosts();
    const user = renderApp("/profit/costs", costsRoute);
    await changeCourierCharge(user);

    // What reached the page untouched: a guarded click is stopped before it gets here.
    const reached: string[] = [];
    const record = (event: MouseEvent) => {
      reached.push((event.target as HTMLElement).textContent ?? "");
      event.preventDefault();
    };
    document.addEventListener("click", record);
    try {
      await user.click(sideLink("Orders in a new tab"));
      await user.click(sideLink("Help centre"));
      await user.keyboard("{Control>}");
      await user.click(sideLink("Orders"));
      await user.keyboard("{/Control}");
      await user.click(sideLink("Another tab of this page"));
    } finally {
      document.removeEventListener("click", record);
    }

    expect(reached).toEqual(["Orders in a new tab", "Help centre", "Orders", "Another tab of this page"]);
    expect(question()).not.toBeInTheDocument();
    expect(path()).toMatch(/^\/profit\/costs/);
  });
});

describe("a reload or a closed tab", () => {
  it("warns while the costs page holds a change, and not before or after", async () => {
    serveCosts();
    const user = renderApp("/profit/costs", costsRoute);
    await screen.findByLabelText("Courier charge per order");
    expect(browserWouldWarn()).toBe(false);

    await changeCourierCharge(user);
    expect(browserWouldWarn()).toBe(true);

    await user.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(browserWouldWarn()).toBe(false));
  });

  it("warns on a changed store settings section", async () => {
    fakeBackend({});
    const user = renderApp("/store-settings/seo", <Route path="/store-settings/:tab" element={<StoreDesignPage />} />);
    const field = await screen.findByLabelText("Page title template");
    expect(browserWouldWarn()).toBe(false);

    await user.type(field, "%s | Nile");
    expect(browserWouldWarn()).toBe(true);
  });

  it("warns on a changed page that only has the save bar", async () => {
    fakeBackend({ "GET /offers/order-rules": { orderRules: { minOrderAmount: 5000 } } });
    const user = renderApp("/offers/order-rules", <Route path="/offers/order-rules" element={<OrderRulesPage />} />);
    const field = await screen.findByLabelText("Minimum order amount");
    await user.clear(field);
    await user.type(field, "90");
    expect(browserWouldWarn()).toBe(true);
  });
});

describe("the guard itself", () => {
  function Form({ dirty }: { dirty: boolean }) {
    useReportDirty(dirty);
    return <p>A form</p>;
  }

  it("counts a form inside a page's own guard, and stops counting it once the page is gone", async () => {
    const page = (dirty: boolean) => (
      <Route
        path="/page"
        element={
          <UnsavedGuardProvider>
            <Form dirty={dirty} />
          </UnsavedGuardProvider>
        }
      />
    );
    const user = renderApp("/page", page(true));
    await screen.findByText("A form");
    expect(browserWouldWarn()).toBe(true);

    await user.click(sideLink("Orders"));
    await user.click(within(await screen.findByRole("dialog", { name: "Discard changes?" })).getByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("heading", { name: "Orders list" })).toBeInTheDocument();
    // The page left with its form: nothing is unsaved any more.
    expect(browserWouldWarn()).toBe(false);
  });

  it("is mounted once by App.tsx, inside the router and around every route", () => {
    const source = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    const router = source.indexOf("<BrowserRouter>");
    const open = source.indexOf("<UnsavedGuardProvider>");
    const routes = source.indexOf("<Routes>");
    const close = source.indexOf("</UnsavedGuardProvider>");
    const routesEnd = source.lastIndexOf("</Routes>");
    expect(router).toBeGreaterThan(-1);
    expect(open).toBeGreaterThan(router);
    expect(routes).toBeGreaterThan(open);
    expect(close).toBeGreaterThan(routesEnd);
    expect(source.match(/<UnsavedGuardProvider>/g)).toHaveLength(1);
  });

  it("is told by every page that shows the save bar", () => {
    const root = resolve(__dirname, "..");
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) sources.push(full);
      }
    };
    walk(root);
    const silent = sources
      .filter((file) => !file.endsWith("SaveBar.tsx"))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return text.includes("<SaveBar") && !/useReportDirty\(|useUnsavedGuard\(/.test(text);
      })
      .map((file) => file.slice(root.length + 1).split("\\").join("/"));
    // A new page with a save bar must also call useReportDirty(dirty), or leaving it loses the edit silently.
    expect(silent).toEqual([]);
    // It reads every source file of the app: quick on a warm disk, slow on a cold one in a busy run.
  }, 60_000);
});
