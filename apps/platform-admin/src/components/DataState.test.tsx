import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { DataState, ListSkeleton } from "./DataState";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function show(loading: boolean, skeleton?: boolean) {
  return render(
    <LocaleProvider>
      <DataState loading={loading} error={null} skeleton={skeleton ? <ListSkeleton variant="table" rows={3} /> : undefined}>
        <p>The table</p>
      </DataState>
    </LocaleProvider>
  );
}

describe("the console's loading state", () => {
  it("a list page shows the shared list skeleton, three rows tall, instead of the Z loader", () => {
    const { container } = show(true, true);
    expect(screen.getByRole("status").textContent).toContain("Loading…");
    expect(container.querySelectorAll('[data-slot="list-skeleton-row"]')).toHaveLength(3);
    expect(container.querySelector('[data-slot="z-loader"]')).toBeNull();
    expect(screen.queryByText("The table")).toBeNull();
  });

  it("a page without one shows the Z loader, announced, and the content once loaded", () => {
    const loading = show(true);
    expect(loading.container.querySelector('[data-slot="z-loader"]')).not.toBeNull();
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Loading…");
    loading.unmount();
    show(false, true);
    expect(screen.getByText("The table")).toBeTruthy();
  });

  it("is announced in Arabic when the console is", () => {
    localStorage.setItem("zimos.console.locale", "ar");
    show(true, true);
    expect(screen.getByRole("status").textContent).toContain("جارٍ التحميل…");
  });
});
