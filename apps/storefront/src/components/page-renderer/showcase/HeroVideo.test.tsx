import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { HeroSlider, type HeroSlide } from "./HeroSlider";
import { HeroVideo } from "./HeroVideo";

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PHONE = "(max-width: 749px)";
const LESS_MOTION = "(prefers-reduced-motion: reduce)";
const CLIP = "https://cdn.zimos.test/ws/clip.mp4";

// --- a browser to play in ---------------------------------------------------

interface FakeQuery {
  matches: boolean;
  listeners: Set<() => void>;
}
let queries = new Map<string, FakeQuery>();

/** What the screen says, and a way to change it while the page is open. */
function screenIs(matches: Record<string, boolean>) {
  queries = new Map();
  const entry = (query: string) => {
    if (!queries.has(query)) queries.set(query, { matches: matches[query] ?? false, listeners: new Set() });
    return queries.get(query)!;
  };
  window.matchMedia = ((query: string) => {
    const state = entry(query);
    return {
      get matches() {
        return state.matches;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => state.listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => state.listeners.delete(listener),
    };
  }) as unknown as typeof window.matchMedia;
  return (query: string, value: boolean) =>
    act(() => {
      const state = entry(query);
      state.matches = value;
      state.listeners.forEach((listener) => listener());
    });
}

let watchers: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit }> = [];

class FakeObserver {
  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {
    watchers.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    watchers = watchers.filter((watcher) => watcher !== this);
  }
}

/** The hero comes onto the screen, or leaves it. */
function onScreen(visible: boolean) {
  act(() => {
    for (const watcher of watchers) watcher.callback([{ isIntersecting: visible } as IntersectionObserverEntry], watcher as unknown as IntersectionObserver);
  });
}

function connectionIs(connection: Record<string, unknown> | undefined) {
  Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
}

let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  watchers = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  connectionIs(undefined);
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  connectionIs(undefined);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

const videoIn = (container: HTMLElement) => container.querySelector("video");

// --- the tests ---------------------------------------------------------------

describe("a slide's background video", () => {
  it("is not in what the server sends: the picture alone", async () => {
    screenIs({});
    const { renderToString } = await import("react-dom/server");
    const html = renderToString(<HeroVideo src={CLIP} active />);
    expect(html).not.toContain("<video");
    expect(html).toContain('class="zs-hero__video"');
  });

  it("waits, fetching nothing, until the hero is near the screen — then plays, muted and in a loop, with no controls", () => {
    screenIs({});
    const { container } = render(<HeroVideo src={CLIP} active />);
    const video = videoIn(container)!;
    expect(video).not.toBeNull();
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.hasAttribute("controls")).toBe(false);
    // Autoplay as an attribute would fetch the file at once: it is started by hand instead.
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.querySelector("source")?.getAttribute("src")).toBe(CLIP);
    expect(video.querySelector("source")?.getAttribute("type")).toBe("video/mp4");
    expect(play).not.toHaveBeenCalled();
    // It asks to be told a little before it scrolls in.
    expect(watchers).toHaveLength(1);
    expect(watchers[0].options?.rootMargin).toBe("200px 0px");

    onScreen(true);
    expect(play).toHaveBeenCalledTimes(1);
    expect(video.muted).toBe(true);
    expect(video.volume).toBe(0);
  });

  it("stays see-through over the picture until its first frame", () => {
    screenIs({});
    const { container } = render(<HeroVideo src={CLIP} active />);
    const video = videoIn(container)!;
    onScreen(true);
    expect(video.hasAttribute("data-showing")).toBe(false);
    act(() => {
      video.dispatchEvent(new Event("playing"));
    });
    expect(video.hasAttribute("data-showing")).toBe(true);
  });

  it("shows the picture only on a phone-wide screen", () => {
    screenIs({ [PHONE]: true });
    const { container } = render(<HeroVideo src={CLIP} active />);
    expect(videoIn(container)).toBeNull();
    expect(watchers).toHaveLength(0);
    expect(play).not.toHaveBeenCalled();
  });

  it("shows the picture only for a visitor who asked for less motion", () => {
    screenIs({ [LESS_MOTION]: true });
    const { container } = render(<HeroVideo src={CLIP} active />);
    expect(videoIn(container)).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("shows the picture only with data saving on or on a slow connection", () => {
    for (const connection of [{ saveData: true, effectiveType: "4g" }, { effectiveType: "3g" }, { effectiveType: "2g" }, { effectiveType: "slow-2g" }]) {
      screenIs({});
      connectionIs(connection);
      const { container, unmount } = render(<HeroVideo src={CLIP} active />);
      expect([connection, videoIn(container)]).toEqual([connection, null]);
      unmount();
    }
    expect(play).not.toHaveBeenCalled();

    screenIs({});
    connectionIs({ saveData: false, effectiveType: "4g" });
    const { container } = render(<HeroVideo src={CLIP} active />);
    expect(videoIn(container)).not.toBeNull();
  });

  it("goes when the window is made phone-wide, and comes back when it is widened", () => {
    const set = screenIs({});
    const { container } = render(<HeroVideo src={CLIP} active />);
    onScreen(true);
    expect(videoIn(container)).not.toBeNull();

    set(PHONE, true);
    expect(videoIn(container)).toBeNull();
    expect(watchers).toHaveLength(0);

    set(PHONE, false);
    expect(videoIn(container)).not.toBeNull();
    // Not near the screen again until the browser says so.
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays only while its slide is the one showing", () => {
    screenIs({});
    const { container, rerender } = render(<HeroVideo src={CLIP} active={false} />);
    onScreen(true);
    expect(videoIn(container)).not.toBeNull();
    expect(play).not.toHaveBeenCalled();

    rerender(<HeroVideo src={CLIP} active />);
    expect(play).toHaveBeenCalledTimes(1);

    pause.mockClear();
    rerender(<HeroVideo src={CLIP} active={false} />);
    expect(pause).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("stops when the hero leaves the screen or the tab is hidden", () => {
    screenIs({});
    render(<HeroVideo src={CLIP} active />);
    onScreen(true);
    expect(play).toHaveBeenCalledTimes(1);

    pause.mockClear();
    onScreen(false);
    expect(pause).toHaveBeenCalled();

    onScreen(true);
    expect(play).toHaveBeenCalledTimes(2);

    pause.mockClear();
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(pause).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(play).toHaveBeenCalledTimes(3);
  });

  it("never makes a sound, even if something turns it up", () => {
    screenIs({});
    const { container } = render(<HeroVideo src={CLIP} active />);
    const video = videoIn(container)!;
    onScreen(true);

    act(() => {
      video.muted = false;
      video.volume = 0.8;
      video.dispatchEvent(new Event("volumechange"));
    });
    expect(video.muted).toBe(true);
    expect(video.volume).toBe(0);
  });

  it("keeps the picture when the browser refuses to play", async () => {
    screenIs({});
    play.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    const { container } = render(<HeroVideo src={CLIP} active />);
    onScreen(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(videoIn(container)!.hasAttribute("data-showing")).toBe(false);
  });
});

describe("the slider with a video slide", () => {
  const slide = (more: Partial<HeroSlide>): HeroSlide => ({
    key: "0",
    image: "https://cdn.zimos.test/hero.jpg",
    mobileImage: null,
    alt: "",
    eyebrow: "",
    heading: "Summer",
    subheading: "",
    buttonLabel: "",
    buttonHref: null,
    side: "center",
    vertical: "bottom",
    contentWidth: 620,
    text: "dark",
    ...more,
  });

  const draw = (slides: HeroSlide[]) =>
    render(
      <HeroSlider
        slides={slides}
        autoplay={false}
        seconds={5}
        startDelay={5}
        arrows
        dots
        wave={false}
        rtl={false}
        label="Offers"
        labels={{ previous: "Previous", next: "Next", slide: "Slide" }}
      />
    );

  it("puts the video over the picture and under the veil, and keeps the picture as its poster", () => {
    screenIs({});
    const { container } = draw([slide({ video: CLIP, overlay: { desktop: 0.3, phone: 0.3 } })]);
    const media = container.querySelector(".zs-hero__media")!;
    expect(Array.from(media.children, (child) => child.className || child.tagName)).toEqual(["PICTURE", "zs-hero__video", "zs-hero__overlay"]);
    expect(media.querySelector("picture img")?.getAttribute("src")).toBe("https://cdn.zimos.test/hero.jpg");
    expect(media.querySelector(".zs-hero__video")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("adds nothing to a slide without a video", () => {
    screenIs({});
    const { container } = draw([slide({}), slide({ key: "1", video: null })]);
    expect(container.querySelector(".zs-hero__video")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(watchers).toHaveLength(0);
  });

  it("plays the video of the slide that is showing, not of the one waiting behind it", () => {
    screenIs({});
    const { container } = draw([slide({ video: CLIP }), slide({ key: "1", video: "https://cdn.zimos.test/ws/second.webm" })]);
    onScreen(true);
    expect(container.querySelectorAll("video")).toHaveLength(2);
    expect(play).toHaveBeenCalledTimes(1);
    expect((play.mock.contexts[0] as HTMLVideoElement).querySelector("source")?.getAttribute("src")).toBe(CLIP);
  });
});
