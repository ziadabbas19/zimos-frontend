import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { resetMocks } from "./mocks";

// Never hit the network: every screen gets the typed `api` double.
vi.mock("@/lib/apiClient", async () => {
  const { api } = await import("./mocks");
  return { apiClient: api, apiBaseUrl: "http://api.test/api/v1" };
});

// Auth + workspace come from mutable test doubles (see renderWithProviders options).
vi.mock("@/context/AuthContext", async () => {
  const { ApiError } = await import("@store-builder/api-client");
  const { authMock } = await import("./mocks");
  return {
    ApiError,
    AuthProvider: ({ children }: { children: unknown }) => children,
    useAuth: () => authMock,
  };
});

vi.mock("@/context/WorkspaceContext", async () => {
  const { workspaceMock } = await import("./mocks");
  return {
    WorkspaceProvider: ({ children }: { children: unknown }) => children,
    useWorkspace: () => workspaceMock,
  };
});

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// jsdom doesn't implement the layout APIs some components call.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
// jsdom has the function but only logs "not implemented": a page that scrolls to the top is not an error.
window.scrollTo = () => undefined;
// jsdom has no scrollTo on an element at all: a panel that scrolls itself back to its top is not an error either.
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => undefined;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => undefined;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => undefined;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
  resetMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
