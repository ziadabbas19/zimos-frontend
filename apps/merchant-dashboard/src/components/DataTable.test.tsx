import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { DataTable, type Column } from "./DataTable";

/**
 * One table for every list: rows of a table from `md` up, and on a phone a
 * card per row (the first named column as the title, the others as
 * label / value lines), so a list no longer scrolls sideways under a finger.
 */

interface Row {
  id: string;
  name: string;
  orders: number;
  note: string | null;
  city: string;
}

const ROWS: Row[] = [
  { id: "a", name: "Mona", orders: 3, note: "Calls after five", city: "Cairo" },
  { id: "b", name: "Omar", orders: 0, note: null, city: "Giza" },
];

function setWidth(phone: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: phone,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function columns(extra: Partial<Record<string, Partial<Column<Row>>>> = {}): Column<Row>[] {
  return [
    { key: "name", header: "Customer", cell: (r) => <a href={`/customers/${r.id}`}>{r.name}</a>, ...extra.name },
    { key: "orders", header: "Orders", align: "end", cell: (r) => r.orders, ...extra.orders },
    { key: "note", header: "Note", cell: (r) => r.note ?? "—", ...extra.note },
    { key: "city", header: "City", cell: (r) => r.city, ...extra.city },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      cell: (r) => (r.id === "a" ? <button type="button">Remove {r.name}</button> : null),
      ...extra.actions,
    },
  ];
}

function show(ui: React.ReactElement, locale: "en" | "ar" = "en") {
  localStorage.setItem("zimos.locale", locale);
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("from a tablet up", () => {
  it("draws a table with every column, as before", () => {
    setWidth(false);
    show(<DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByRole("list")).toBeNull();
    // The placeholder of an empty cell stays in a table: the column must not collapse.
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("calls the row handler and keeps the footer", () => {
    setWidth(false);
    const onRowClick = vi.fn();
    show(<DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} onRowClick={onRowClick} footer={<p>2 customers</p>} />);
    fireEvent.click(screen.getByText("Giza"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
    expect(screen.getByText("2 customers")).toBeTruthy();
  });
});

describe("on a phone", () => {
  it("draws one card per row instead of a table", () => {
    setWidth(true);
    show(<DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} footer={<p>2 customers</p>} />);
    expect(screen.queryByRole("table")).toBeNull();
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    // The first named column is the card's title; its link is still a link.
    expect(within(cards[0]).getByRole("link", { name: "Mona" }).closest(".card-title")).not.toBeNull();
    // The others are label / value lines.
    const terms = within(cards[0]).getAllByRole("term").map((el) => el.textContent);
    expect(terms).toEqual(["Orders", "Note", "City"]);
    expect(within(cards[0]).getByText("Calls after five")).toBeTruthy();
    expect(screen.getByText("2 customers")).toBeTruthy();
  });

  it("leaves out a line that says nothing, and the strip of a row with no action", () => {
    setWidth(true);
    show(<DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} />);
    const [mona, omar] = screen.getAllByRole("listitem");
    expect(within(omar).getAllByRole("term").map((el) => el.textContent)).toEqual(["Orders", "City"]);
    expect(screen.queryByText("—")).toBeNull();
    // A column without a text header is the row's actions: its content alone, at the end.
    expect(within(mona).getByRole("button", { name: "Remove Mona" })).toBeTruthy();
    expect(within(omar).queryByRole("button")).toBeNull();
    expect(screen.queryByText("Actions")).toBeNull();
  });

  it("honours phoneHidden and phoneSkip", () => {
    setWidth(true);
    show(
      <DataTable
        columns={columns({ city: { phoneHidden: true }, orders: { phoneSkip: (r) => r.orders === 0 } })}
        rows={ROWS}
        rowKey={(r) => r.id}
      />
    );
    const [mona, omar] = screen.getAllByRole("listitem");
    expect(within(mona).getAllByRole("term").map((el) => el.textContent)).toEqual(["Orders", "Note"]);
    expect(within(omar).queryAllByRole("term")).toHaveLength(0);
    expect(screen.queryByText("Cairo")).toBeNull();
  });

  it("opens the row from anywhere on the card, but not from a control inside it", () => {
    setWidth(true);
    const onRowClick = vi.fn();
    const onRemove = vi.fn();
    const cols = columns({
      actions: {
        cell: (r) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(r.id);
            }}
          >
            Remove {r.name}
          </button>
        ),
      },
    });
    show(<DataTable columns={cols} rows={ROWS} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("Giza"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Mona" }));
    expect(onRemove).toHaveBeenCalledWith("a");
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("stays a table where the page asks for one", () => {
    setWidth(true);
    show(<DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} phoneCards={false} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("a tick box column", () => {
  function Ticked({ onRowClick }: { onRowClick?: (row: Row) => void }) {
    const [ids, setIds] = useState<Set<string>>(new Set());
    const all = ROWS.every((r) => ids.has(r.id));
    const select: Column<Row> = {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label="Select every customer"
          checked={all}
          onChange={(e) => setIds(e.target.checked ? new Set(ROWS.map((r) => r.id)) : new Set())}
        />
      ),
      cell: (r) => (
        <input
          type="checkbox"
          aria-label={`Select ${r.name}`}
          checked={ids.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            setIds((prev) => {
              const next = new Set(prev);
              if (e.target.checked) next.add(r.id);
              else next.delete(r.id);
              return next;
            })
          }
        />
      ),
    };
    return (
      <>
        <p>{ids.size} selected</p>
        <DataTable columns={[select, ...columns()]} rows={ROWS} rowKey={(r) => r.id} onRowClick={onRowClick} />
      </>
    );
  }

  it("sits beside the card's title and ticks without opening the row", () => {
    setWidth(true);
    const onRowClick = vi.fn();
    show(<Ticked onRowClick={onRowClick} />);
    const [mona] = screen.getAllByRole("listitem");
    // The title is still the first NAMED column, not the tick box.
    expect(within(mona).getByRole("link", { name: "Mona" }).closest(".card-title")).not.toBeNull();
    fireEvent.click(within(mona).getByRole("checkbox", { name: "Select Mona" }));
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("keeps the table's tick-every-row box over the cards", () => {
    setWidth(true);
    show(<Ticked />);
    const all = screen.getByRole("checkbox", { name: "Select every customer" });
    expect(screen.getByText("Select all")).toBeTruthy();
    fireEvent.click(all);
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(all);
    expect(screen.getByText("0 selected")).toBeTruthy();
  });

  it("says it in Arabic too", () => {
    setWidth(true);
    show(<Ticked />, "ar");
    expect(screen.getByText("تحديد الكل")).toBeTruthy();
  });
});

describe("nothing to show yet", () => {
  it("draws the page's empty state when there are no rows", () => {
    setWidth(true);
    show(<DataTable columns={columns()} rows={[]} rowKey={(r) => r.id} empty={<p>No customers yet</p>} />);
    expect(screen.getByText("No customers yet")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("holds the empty state back during the first load and says it is loading", () => {
    for (const phone of [false, true]) {
      setWidth(phone);
      const view = show(<DataTable columns={columns()} rows={[]} rowKey={(r) => r.id} empty={<p>No customers yet</p>} loading />);
      expect(screen.queryByText("No customers yet")).toBeNull();
      expect(screen.getByRole("status").textContent).toContain("Loading…");
      view.unmount();
    }
  });

  it("keeps the rows it has while a refresh is on its way", () => {
    setWidth(false);
    show(<DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} loading />);
    expect(screen.getByText("Mona")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
