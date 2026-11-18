import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoSection } from "./VideoSection";

const words = { playLabel: "Play video", videoLabel: "Video", noVideoLabel: "No video" };

describe("a merchant's video on the store", () => {
  it("waits for a press before loading YouTube, then loads the fenced player", () => {
    const { container } = render(<VideoSection {...words} url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Our story" />);
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play video: Our story" }));
    const frame = screen.getByTitle("Our story");
    expect(frame.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-presentation allow-popups");
    expect(frame.getAttribute("allow")).toBe("fullscreen; picture-in-picture");
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(frame.getAttribute("loading")).toBe("lazy");
  });

  it("loads other hosts' players straight away, named for a screen reader", () => {
    render(<VideoSection {...words} url="https://www.loom.com/share/0123456789abcdef0123456789abcdef" />);
    expect(screen.getByTitle("Video").getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-presentation");
  });

  it.each([["https://evil.example/player"], ["javascript:alert(1)"], ['<iframe src="https://evil.example/x"></iframe>'], ["<script>alert(1)</script>"], [""]])(
    "draws nothing for %s",
    (url) => {
      const { container } = render(<VideoSection {...words} url={url} />);
      expect(container.innerHTML).toBe("");
    }
  );

  it("plays a file by itself only when asked, muted and on a loop", () => {
    const { container, rerender } = render(<VideoSection {...words} url="https://cdn.example.com/film.mp4" />);
    const plain = container.querySelector("video") as HTMLVideoElement;
    expect(plain.autoplay).toBe(false);
    expect(plain.controls).toBe(true);
    rerender(<VideoSection {...words} url="https://cdn.example.com/film.mp4" autoplay />);
    const moving = container.querySelector("video") as HTMLVideoElement;
    expect(moving.autoplay).toBe(true);
    expect(moving.muted).toBe(true);
    expect(moving.loop).toBe(true);
  });

  it("keeps the chosen shape, a reel's own shape when none is chosen, and square corners when asked", () => {
    const { container, rerender } = render(<VideoSection {...words} url="https://www.instagram.com/reel/Cabc12345/" />);
    const box = () => container.querySelector('[data-slot="video-frame"]') as HTMLElement;
    expect(box().style.aspectRatio).toBe("9 / 16");
    rerender(<VideoSection {...words} url="https://www.instagram.com/reel/Cabc12345/" aspect="1:1" rounded={false} />);
    expect(box().style.aspectRatio).toBe("1 / 1");
    expect(box().className).not.toContain("rounded-2xl");
  });

  it("shows the caption under the video", () => {
    render(<VideoSection {...words} url="https://cdn.example.com/film.mp4" caption="Made in Cairo" />);
    expect(screen.getByText("Made in Cairo").tagName).toBe("FIGCAPTION");
  });
});
