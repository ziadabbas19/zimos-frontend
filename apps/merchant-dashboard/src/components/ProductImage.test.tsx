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

  it("asks for no copies of a picture that has none", () => {
    render(<ProductImage media={media} alt="Mug" size={40} />);
    expect(screen.getByRole("img", { name: "Mug" })).not.toHaveAttribute("srcset");
  });

  it("picks among a picture's smaller copies by the box's size, its own file staying the src", () => {
    const url = "https://media.test/ws/00000000-0000-4000-8000-000000000001-t.jpg";
    render(<ProductImage media={{ ...media, url }} alt="Mug" size={40} />);
    const img = screen.getByRole("img", { name: "Mug" });
    expect(img).toHaveAttribute("src", url);
    expect(img.getAttribute("srcset")).toContain("https://media.test/ws/00000000-0000-4000-8000-000000000001-t-w320.webp 320w");
    expect(img).toHaveAttribute("sizes", "40px");
  });

  it("shows the placeholder when there is no picture", () => {
    render(<ProductImage media={null} alt="Mug" size={40} />);
    expect(screen.getByRole("img", { name: "Mug (no image)" }).tagName).toBe("DIV");
  });
});
