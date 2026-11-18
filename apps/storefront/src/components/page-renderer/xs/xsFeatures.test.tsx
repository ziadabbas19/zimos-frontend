import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { XsFeaturesElement } from "./home";

const draw = (items: unknown[]) => render(<XsFeaturesElement props={{ items }} look="24" locale="en" />);

describe("xs_features cards", () => {
  it("shows a card's title and text", () => {
    draw([{ title: "Cash on delivery", text: "No upfront payment" }]);
    expect(screen.getByRole("heading", { name: "Cash on delivery" })).toBeTruthy();
    expect(screen.getByText("No upfront payment")).toBeTruthy();
  });

  it("uses the text as the title when the title is missing", () => {
    draw([{ title: "", text: "No upfront payment" }]);
    expect(screen.getByRole("heading", { name: "No upfront payment" })).toBeTruthy();
  });

  it("never shows a lone letter left in a title", () => {
    draw([{ title: "M", text: "Open it in front of the courier" }]);
    expect(screen.queryByText("M")).toBeNull();
    expect(screen.getByRole("heading", { name: "Open it in front of the courier" })).toBeTruthy();
  });

  it("drops a card with nothing to say", () => {
    const { container } = draw([{ title: "M", text: "" }, { title: "Fast delivery", text: "" }]);
    expect(container.querySelectorAll(".xs-features__item")).toHaveLength(1);
  });
});
