import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { SupportTicket } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FormSubmissionsPage } from "../customers/FormSubmissionsPage";
import { SupportPage } from "./SupportPage";

/**
 * Two lists that read like an inbox: the store's support tickets, and what
 * shoppers sent through the site's forms.
 */

interface Init {
  method?: string;
  body?: unknown;
}

const writes = () => api.request.mock.calls.filter(([, init]) => init?.method).map(([path, init]) => ({ path, method: init?.method, body: init?.body }));

afterEach(() => {
  api.request.mockReset();
  api.listSupportTickets.mockReset();
  api.openSupportTicket.mockReset();
});

describe("the support page", () => {
  const ticket = fake<SupportTicket>({
    id: "t1",
    workspaceId: "ws_1",
    subject: "Courier never came",
    category: "shipping",
    status: "pending",
    priority: "normal",
    createdBy: "Amr Hassan",
    lastMessageAt: "2026-10-09T10:00:00Z",
    lastMessageBy: "admin",
    messageCount: 3,
    createdAt: "2026-10-08T10:00:00Z",
    updatedAt: "2026-10-09T10:00:00Z",
  });

  it("lists the store's tickets and keeps the other ways to reach ZIMOS under them", async () => {
    api.listSupportTickets.mockResolvedValue([ticket]);
    renderWithProviders(<SupportPage />, { route: "/support" });

    expect((await screen.findAllByText("Courier never came")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Waiting on you").length).toBeGreaterThan(0);
    // ZIMOS's social accounts and email: this product's own part of the page.
    expect(screen.getByRole("heading", { name: "Other ways to reach us" })).toBeInTheDocument();
  });

  it("opens a new ticket from a sheet and sends what was written", async () => {
    api.listSupportTickets.mockResolvedValue([]);
    api.openSupportTicket.mockResolvedValue(fake({ ticket: { ...ticket, id: "t2" }, messages: [] }));
    const { user } = renderWithProviders(<SupportPage />, { route: "/support" });

    await user.click((await screen.findAllByRole("button", { name: "New ticket" }))[0]);
    await screen.findByRole("dialog", { name: "New ticket" });
    await user.type(await screen.findByRole("textbox", { name: /Subject/ }), "Refund for order 1042");
    await user.type(screen.getByRole("textbox", { name: /Message/ }), "The customer returned it yesterday.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(api.openSupportTicket).toHaveBeenCalledTimes(1));
    expect(api.openSupportTicket.mock.calls[0][1]).toMatchObject({ subject: "Refund for order 1042", body: "The customer returned it yesterday." });
  });

  it("reads in the dashboard's own Arabic", async () => {
    api.listSupportTickets.mockResolvedValue([ticket]);
    renderWithProviders(<SupportPage />, { route: "/support", locale: "ar" });

    expect((await screen.findAllByText("تنتظر ردك")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "تذكرة جديدة" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "طرق أخرى للتواصل معنا" })).toBeInTheDocument();
  });
});

describe("the form messages page", () => {
  const message = {
    id: "m1",
    customerId: "c1",
    formName: "Contact us",
    pagePath: "/contact",
    fullName: "Mona Adel",
    phone: "01012345678",
    email: null,
    message: "Do you deliver to Aswan?",
    data: {},
    tags: [],
    marketingConsent: false,
    isRead: false,
    createdAt: "2026-10-09T10:00:00Z",
  };

  function serve() {
    api.request.mockImplementation(async (path: string, init?: Init) => {
      if (path.startsWith("/workspaces/ws_1/contacts/forms") && !init?.method) return { submissions: [message], nextCursor: null, forms: [{ formName: "Contact us", count: 1 }], unread: 1 };
      if (path === "/workspaces/ws_1/contacts/forms/m1" && init?.method === "PATCH") return { submission: { ...message, isRead: true } };
      return new Promise(() => undefined);
    });
  }

  it("shows who wrote and how the message starts, and marks it read when it is opened", async () => {
    serve();
    const { user } = renderWithProviders(<FormSubmissionsPage />, { route: "/form-submissions" });

    expect((await screen.findAllByText("Mona Adel")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Do you deliver to Aswan\?/).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Read the message from Mona Adel" })[0]);
    await waitFor(() => expect(writes()).toEqual([{ path: "/workspaces/ws_1/contacts/forms/m1", method: "PATCH", body: { isRead: true } }]));
  });

  it("counts what is unread, in the dashboard's own Arabic", async () => {
    serve();
    renderWithProviders(<FormSubmissionsPage />, { route: "/form-submissions", locale: "ar" });

    expect((await screen.findAllByText("Mona Adel")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/غير مقروءة/).length).toBeGreaterThan(0);
  });
});
