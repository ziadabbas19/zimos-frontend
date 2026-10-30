import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProductMedia } from "@store-builder/api-client";
import { ProductImage } from "./ProductImage";

const media: ProductMedia = { url: "https://media.test/ws/a.jpg", path: "/ws/a.jpg", mimeType: "image/jpeg", size: 120_000 };

describe("ProductImage", () => {
  it("loads the picture near the screen only, decoded off the main thread", () => {
    render(<ProductImage media={media} alt="Mug" className="size-10" />);
    const img = screen.getByRole("img", { name: "Mug" });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).not.toHaveAttribute("width");
  });

  it("names a fixed box's size on the img, the classes still drawing it", () => {
    render(<ProductImage media={media} alt="Mug" className="size-10" size={40} />);
    const img = screen.getByRole("img", { name: "Mug" });
    expect(img).toHaveAttribute("width", "40");
    expect(img).toHaveAttribute("height", "40");
    expect(img).toHaveClass("h-full", "w-full", "object-cover");
  });

  it("shows the placeholder when there is no picture", () => {
    render(<ProductImage media={null} alt="Mug" size={40} />);
    expect(screen.getByRole("img", { name: "Mug (no image)" }).tagName).toBe("DIV");
  });
});
