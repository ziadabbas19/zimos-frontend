import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoSourceField } from "./VideoSourceField";

vi.mock("@/components/MediaPicker", () => ({ MediaPicker: () => null }));

function setup(value = "") {
  const onChange = vi.fn();
  render(<VideoSourceField label="Video link or embed code" value={value} autoplay={false} onChange={onChange} />);
  return { onChange, box: screen.getByRole("textbox", { name: "Video link or embed code" }) };
}

describe("the Video section's source field", () => {
  it("stores only the clean address of a pasted link", () => {
    const { onChange, box } = setup();
    fireEvent.change(box, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    expect(onChange).toHaveBeenCalledWith("url", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(screen.getByText("YouTube video is ready.")).toBeTruthy();
  });

  it("stores only the address out of pasted embed code", () => {
    const { onChange, box } = setup();
    fireEvent.change(box, { target: { value: '<iframe src="https://player.vimeo.com/video/123456789" onload="alert(1)"></iframe>' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("url", "https://player.vimeo.com/video/123456789");
  });

  it.each([
    ["https://evil.example/player", /isn't supported/],
    ["<script>alert(1)</script>", /can't be used/],
    ["javascript:alert(1)", /can't be used/],
    ["https://vm.tiktok.com/ZMabc123/", /short link/],
  ])("says what is wrong with %s and stores nothing", (text, message) => {
    const { onChange, box } = setup();
    fireEvent.change(box, { target: { value: text } });
    expect(screen.getByRole("alert").textContent).toMatch(message);
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the video when the box is emptied", () => {
    const { onChange, box } = setup("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    fireEvent.change(box, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("url", "");
  });

  it("offers playing by itself for a video file only", () => {
    const { box } = setup("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(screen.queryByText("Play by itself, muted, on a loop")).toBeNull();
    fireEvent.change(box, { target: { value: "https://cdn.example.com/film.mp4" } });
    expect(screen.getByText("Play by itself, muted, on a loop")).toBeTruthy();
  });
});
