import { describe, expect, it } from "vitest";
import { naturalAspect, parseVideoSource, videoPoster, videoSandbox } from "@store-builder/api-client/video-embed";

describe("reading a video address", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "youtube", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/123456789", "vimeo", "https://player.vimeo.com/video/123456789"],
    ["https://vimeo.com/123456789/abcdef1234", "vimeo", "https://player.vimeo.com/video/123456789?h=abcdef1234"],
    ["https://www.facebook.com/watch/?v=1234567890", "facebook", "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D1234567890&show_text=false"],
    ["https://www.instagram.com/reel/Cabc12345/", "instagram", "https://www.instagram.com/reel/Cabc12345/embed/"],
    ["https://www.tiktok.com/@shop/video/7234567890123456789", "tiktok", "https://www.tiktok.com/player/v1/7234567890123456789"],
    ["https://zimos.wistia.com/medias/abc123def4", "wistia", "https://fast.wistia.net/embed/iframe/abc123def4"],
    ["https://www.loom.com/share/0123456789abcdef0123456789abcdef", "loom", "https://www.loom.com/embed/0123456789abcdef0123456789abcdef"],
    ["https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing", "drive", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview"],
  ])("reads %s", (input, provider, src) => {
    const parsed = parseVideoSource(input);
    expect(parsed).toMatchObject({ ok: true, kind: "iframe", provider, src });
    // What is stored reads the same every time it is drawn.
    expect(parseVideoSource(src)).toMatchObject({ ok: true, provider, src });
  });

  it("takes a direct video file", () => {
    expect(parseVideoSource("https://cdn.example.com/film.mp4")).toMatchObject({ ok: true, kind: "file", src: "https://cdn.example.com/film.mp4" });
    expect(parseVideoSource("/media/film.webm")).toMatchObject({ ok: true, kind: "file" });
  });

  it("reads only the address out of pasted iframe code", () => {
    const parsed = parseVideoSource('<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=a&amp;b=1" onload="alert(1)" allowfullscreen></iframe>');
    expect(parsed).toMatchObject({ ok: true, provider: "youtube", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", aspect: "16:9" });
    expect(JSON.stringify(parsed)).not.toContain("alert");
  });

  it.each([
    ["<script>alert(1)</script>"],
    ['<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><script src="https://evil.example/x.js"></script>'],
    ['<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" srcdoc="<script>alert(1)</script>"></iframe>'],
    ["< script >alert(1)</script>"],
    ["<img src=x onerror=alert(1)>"],
    ["<svg onload=alert(1)>"],
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["java\nscript:alert(1)"],
    ["&#106;avascript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ['<iframe src="javascript:alert(1)"></iframe>'],
    ['<iframe src="&#106;avascript:alert(1)"></iframe>'],
    ['<iframe src="data:text/html;base64,PHNjcmlwdD4="></iframe>'],
    ["https://www.youtube.com@evil.example/embed/dQw4w9WgXcQ"],
  ])("refuses %s", (input) => {
    expect(parseVideoSource(input)).toEqual({ ok: false, problem: "unsafe" });
  });

  it.each([
    ["https://evil.example/embed/video"],
    ["https://youtube.com.evil.example/embed/dQw4w9WgXcQ"],
    ["https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://notyoutube.com/watch?v=dQw4w9WgXcQ"],
    ["https://www.youtube.com:8443/embed/dQw4w9WgXcQ"],
    ['<iframe src="https://evil.example/player"></iframe>'],
    ["/about"],
  ])("refuses the unknown host in %s", (input) => {
    expect(parseVideoSource(input)).toEqual({ ok: false, problem: "unknown-host" });
  });

  it("asks for the full address of a short TikTok link", () => {
    expect(parseVideoSource("https://vm.tiktok.com/ZMabc123/")).toEqual({ ok: false, problem: "short-link" });
  });

  it("never loads a Facebook plugin address that points elsewhere", () => {
    const inner = encodeURIComponent("https://evil.example/videos/123456");
    expect(parseVideoSource(`https://www.facebook.com/plugins/video.php?href=${inner}`).ok).toBe(false);
  });

  it("says nothing for an empty box", () => {
    expect(parseVideoSource("   ")).toEqual({ ok: false, problem: "empty" });
    expect(parseVideoSource(undefined)).toEqual({ ok: false, problem: "empty" });
  });
});

describe("how a video is drawn", () => {
  it("gives a player only what it needs", () => {
    expect(videoSandbox("youtube")).toBe("allow-scripts allow-same-origin allow-presentation allow-popups");
    expect(videoSandbox("loom")).toBe("allow-scripts allow-same-origin allow-presentation");
    for (const provider of ["youtube", "vimeo", "facebook", "instagram", "tiktok", "wistia", "loom", "drive"] as const) {
      expect(videoSandbox(provider)).not.toMatch(/allow-top-navigation|allow-forms|allow-modals|escape-sandbox/);
    }
  });

  it("makes reels tall and everything else wide", () => {
    expect(naturalAspect(parseVideoSource("https://www.instagram.com/reel/Cabc12345/"))).toBe("9:16");
    expect(naturalAspect(parseVideoSource("https://www.tiktok.com/@shop/video/7234567890123456789"))).toBe("9:16");
    expect(naturalAspect(parseVideoSource("https://vimeo.com/123456789"))).toBe("16:9");
  });

  it("has a poster for YouTube only", () => {
    expect(videoPoster(parseVideoSource("https://youtu.be/dQw4w9WgXcQ"))).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(videoPoster(parseVideoSource("https://vimeo.com/123456789"))).toBeNull();
  });
});
