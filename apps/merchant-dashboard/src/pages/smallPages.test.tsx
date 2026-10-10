import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ActivityLogPage } from "./activity/ActivityLogPage";
import { NotFoundPage } from "./NotFoundPage";
import { ServicesPage } from "./services/ServicesPage";
import { ShoppableImagesPage } from "./shoppable/ShoppableImagesPage";

/** Four small pages that kept their calls and got a new layout. */

interface Init {
  method?: string;
  body?: unknown;
}

function serve(answer: (path: string, init?: Init) => unknown) {
  api.listWorkspaceMembers.mockResolvedValue([]);
  api.request.mockImplementation(async (path: string, init?: Init) => {
    const found = answer(path, init);
    return found !== undefined ? found : new Promise(() => undefined);
  });
}

afterEach(() => {
  api.request.mockReset();
});

describe("a page that is not there", () => {
  it("says so and offers the way home", () => {
    renderWithProviders(<NotFoundPage />, { route: "/nowhere" });
    expect(screen.getByRole("heading", { name: "This page isn't here" })).toBeInTheDocument();
    expect(screen.getByText("Go to the home page").closest("a")).toHaveAttribute("href", "/");
  });

  it("reads in the dashboard's own Arabic", () => {
    renderWithProviders(<NotFoundPage />, { route: "/nowhere", locale: "ar" });
    expect(screen.getByRole("heading", { name: "هذه الصفحة غير موجودة" })).toBeInTheDocument();
  });
});

describe("the services page", () => {
  const listing = {
    id: "s1",
    category: "design",
    title: "Store design",
    titleAr: "تصميم المتجر",
    description: "A full store look in a week.",
    descriptionAr: "مظهر كامل للمتجر في أسبوع.",
    providerName: "Nile Studio",
    providerLogoUrl: null,
    priceAmount: null,
    priceCurrency: null,
    priceUnit: null,
    contactWhatsapp: "201000000000",
    contactUrl: null,
    contactEmail: null,
  };

  it("lists the providers and narrows them as a name is typed", async () => {
    serve((path) => (path.startsWith("/service-listings") ? { listings: [listing] } : undefined));
    const { user } = renderWithProviders(<ServicesPage />, { route: "/services" });

    expect(await screen.findByText("Store design")).toBeInTheDocument();
    expect(screen.getAllByText("Nile Studio").length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Search the services"), "accounting");
    await waitFor(() => expect(screen.queryByText("Store design")).not.toBeInTheDocument());
  });

  it("says when nothing is listed yet", async () => {
    serve((path) => (path.startsWith("/service-listings") ? { listings: [] } : undefined));
    renderWithProviders(<ServicesPage />, { route: "/services", locale: "ar" });
    expect(await screen.findByText(/يظهر مقدمو الخدمات هنا عندما يضيفهم فريق Zimos/)).toBeInTheDocument();
  });
});

describe("the activity log", () => {
  const entry = {
    id: "a1",
    action: "order.confirmed",
    entityType: "order",
    entityId: "o1",
    createdAt: new Date().toISOString(),
    ipAddress: null,
    actor: { id: "u1", fullName: "Mona Adel", email: "mona@zimos.test" },
    before: null,
    after: null,
  };

  it("reads the store's changes and names who made each", async () => {
    serve((path) => (path.startsWith("/workspaces/ws_1/audit-logs") ? { logs: [entry], nextCursor: null } : undefined));
    renderWithProviders(<ActivityLogPage />, { route: "/activity" });

    expect(await screen.findByText(/Mona Adel/)).toBeInTheDocument();
    expect(screen.getByText("Every change made in this store: who made it and when.")).toBeInTheDocument();
    expect(api.request.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it("says what the log is for while it is empty, in formal Arabic", async () => {
    serve((path) => (path.startsWith("/workspaces/ws_1/audit-logs") ? { logs: [], nextCursor: null } : undefined));
    renderWithProviders(<ActivityLogPage />, { route: "/activity", locale: "ar" });

    expect(await screen.findByText("لا يوجد شيء مسجّل بعد")).toBeInTheDocument();
    expect(screen.getByText("كل تغيير حدث في المتجر: من أجراه ومتى.")).toBeInTheDocument();
  });
});

describe("the shoppable images page", () => {
  const look = {
    id: "l1",
    title: "Living room",
    slug: "living-room",
    imageUrl: "https://cdn.zimos.test/room.jpg",
    hotspots: [{ x: 0.4, y: 0.5, productId: "p1" }],
    isActive: true,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
  };

  it("hides a picture from the store from its menu and offers to take that back", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/shoppable-images" && !init?.method) return { images: [look] };
      if (path === "/workspaces/ws_1/shoppable-images/l1" && init?.method === "PATCH") return { image: { ...look, ...(init.body as object) } };
      return undefined;
    });
    const { user } = renderWithProviders(<ShoppableImagesPage />, { route: "/shoppable-images" });

    await user.click(await screen.findByRole("button", { name: "Actions for “Living room”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Hide from the store" }));

    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/shoppable-images/l1", expect.objectContaining({ method: "PATCH", body: { isActive: false } }))
    );
    expect(await screen.findByText("“Living room” is off your store.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve((path, init) => (path === "/workspaces/ws_1/shoppable-images" && !init?.method ? { images: [look] } : undefined));
    renderWithProviders(<ShoppableImagesPage />, { route: "/shoppable-images", locale: "ar" });

    expect(await screen.findByRole("button", { name: "إجراءات «Living room»" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "الصور التفاعلية" })).toBeInTheDocument();
  });
});
