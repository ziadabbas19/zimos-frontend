import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FontPicker } from "@store-builder/ui/font-picker";
import type { FontOption } from "@store-builder/ui/fonts";

/**
 * The shared store font picker (@store-builder/ui/font-picker): only fonts
 * for its script, search and the two filters, the keyboard, "store default",
 * both languages — and previews that load one row at a time, never the
 * catalog.
 */

const font = (id: string, family: string, script: FontOption["script"], category: FontOption["category"]): FontOption => ({
  id,
  family,
  script,
  category,
  weights: [400, 700],
  preview: script === "latin" ? "Your store" : "متجرك",
});

const CATALOG: FontOption[] = [
  font("cairo", "Cairo", "both", "sans"),
  font("amiri", "Amiri", "ar", "naskh"),
  font("reem-kufi", "Reem Kufi", "ar", "kufi"),
  font("almarai", "Almarai", "ar", "sans"),
  font("inter", "Inter", "latin", "sans"),
  font("lora", "Lora", "latin", "serif"),
  font("bebas-neue", "Bebas Neue", "latin", "display"),
];

function Harness({
  role = "ar",
  initial = null,
  locale = "en",
  onChange = vi.fn(),
}: {
  role?: "ar" | "en";
  initial?: string | null;
  locale?: "en" | "ar";
  onChange?: (id: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <FontPicker
      fonts={CATALOG}
      role={role}
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange(id);
      }}
      locale={locale}
      label={locale === "ar" ? "الخط العربي" : "Arabic font"}
      defaultName="Tajawal"
    />
  );
}

const rows = () => within(screen.getByRole("listbox")).getAllByRole("option");
const names = () => rows().slice(1).map((row) => row.getAttribute("data-font"));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FontPicker", () => {
  it("shows the store default until a font is picked, and offers only fonts with the script's letters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /^Arabic font/ });
    expect(trigger).toHaveTextContent("Store default (Tajawal)");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(names()).toEqual(["cairo", "amiri", "reem-kufi", "almarai"]);
    expect(rows()[0]).toHaveTextContent("Use store default");
    expect(rows()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("offers Latin and bilingual fonts for English text", async () => {
    const user = userEvent.setup();
    render(<Harness role="en" />);
    await user.click(screen.getByRole("button", { name: /^Arabic font/ }));
    expect(names()).toEqual(["cairo", "inter", "lora", "bebas-neue"]);
  });

  it("filters by name, by style and by letters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^Arabic font/ }));

    await user.type(screen.getByRole("combobox", { name: "Search fonts by name" }), "ree");
    expect(names()).toEqual(["reem-kufi"]);
    await user.clear(screen.getByRole("combobox"));

    await user.click(screen.getByRole("button", { name: "Naskh" }));
    expect(screen.getByRole("button", { name: "Naskh" })).toHaveAttribute("aria-pressed", "true");
    expect(names()).toEqual(["amiri"]);
    await user.click(screen.getByRole("button", { name: "All", pressed: false }));

    await user.click(screen.getByRole("button", { name: "Arabic + English" }));
    expect(names()).toEqual(["cairo"]);
    await user.click(screen.getByRole("button", { name: "Arabic only" }));
    expect(names()).toEqual(["amiri", "reem-kufi", "almarai"]);

    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("No font matches. Try another name or style.")).toBeInTheDocument();
  });

  it("is driven from the keyboard: arrows move, Enter picks, Escape closes and returns the focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: /^Arabic font/ });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const search = screen.getByRole("combobox");
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute("aria-activedescendant", rows()[0].id);

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(search).toHaveAttribute("aria-activedescendant", rows()[2].id);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("amiri");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent("Amiri");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", rows()[2].id);
    await user.keyboard("{End}");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", rows()[4].id);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("goes back to the store default from the list or from its own button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="amiri" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Use store default — Arabic font" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: /^Arabic font/ })).toHaveTextContent("Store default (Tajawal)");

    await user.click(screen.getByRole("button", { name: /^Arabic font/ }));
    await user.click(rows()[3]);
    expect(onChange).toHaveBeenLastCalledWith("reem-kufi");
    await user.click(screen.getByRole("button", { name: /^Arabic font/ }));
    await user.click(rows()[0]);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("speaks Arabic", async () => {
    const user = userEvent.setup();
    render(<Harness locale="ar" />);
    const trigger = screen.getByRole("button", { name: /^الخط العربي/ });
    expect(trigger).toHaveTextContent("خط المتجر الافتراضي (Tajawal)");
    await user.click(trigger);
    expect(screen.getByRole("combobox", { name: "ابحث عن خط بالاسم" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "نسخ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "عربي فقط" })).toBeInTheDocument();
  });

  it("loads a row's face only when the row is shown — never the whole catalog", async () => {
    const fetched: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetched.push(url);
        // A `text=` stylesheet as Google writes it: one face, no subset comment.
        return new Response(
          "@font-face {\n  font-family: 'Lora';\n  font-style: normal;\n  font-weight: 400;\n  src: url(https://fonts.gstatic.com/l/font?kit=abc&skey=def&v=v1) format('woff2');\n  unicode-range: U+20, U+4c;\n}",
          { status: 200 }
        );
      })
    );
    vi.stubGlobal(
      "FontFace",
      class {
        load() {
          return Promise.resolve(this);
        }
      }
    );
    const shown: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    const observed: Element[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
          shown.push(cb);
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
      }
    );
    if (!document.fonts) Object.defineProperty(document, "fonts", { value: { add() {} }, configurable: true });

    const user = userEvent.setup();
    render(<Harness role="en" />);
    await user.click(screen.getByRole("button", { name: /^Arabic font/ }));
    // Open, nothing scrolled into view yet: no face asked for.
    expect(fetched).toEqual([]);
    expect(observed).toHaveLength(4);

    // One row comes into view: its face, with exactly the letters it shows.
    shown[2]([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(fetched).toHaveLength(1));
    expect(fetched[0]).toContain("family=Lora&text=");
    expect(decodeURIComponent(fetched[0])).toContain("Lora Your store");

    // Once loaded, the row is drawn in it — a list a browser accepts (no `inherit` inside it).
    const lora = rows().find((row) => row.getAttribute("data-font") === "lora")!;
    await vi.waitFor(() => expect(lora.querySelector('[lang="en"]')!.getAttribute("style")).toContain('font-family: "zfp-lora", system-ui, sans-serif'));
  });
});
