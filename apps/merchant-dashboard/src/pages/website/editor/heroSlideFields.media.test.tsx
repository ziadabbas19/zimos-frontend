import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { MediaAsset } from "@store-builder/api-client";
import { MediaPicker } from "@/components/MediaPicker";
import { EditorLocaleContext } from "./editorLocale";
import { ItemListField, type ItemSubField } from "./ItemListField";
import { SHOWCASE_ELEMENT_SPECS } from "./showcaseBlocks";
import { HEAVY_VIDEO_BYTES } from "./VideoField";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";

// The switch on: what the editor offers once VITE_HERO_MEDIA_ENABLED is "true".
vi.mock("@/lib/features", async (original) => ({ ...(await original<typeof import("@/lib/features")>()), HERO_MEDIA_ENABLED: true }));

type Slide = Record<string, unknown>;

function slideFields(): ItemSubField[] {
  const slides = SHOWCASE_ELEMENT_SPECS.hero_slider.fields.find((field) => field.key === "slides");
  if (!slides || slides.kind !== "itemList") throw new Error("the picture slider has no slides field");
  return slides.fields;
}

function Slides({ start, onChange }: { start: Slide[]; onChange: (next: Slide[]) => void }) {
  const [value, setValue] = useState<Slide[]>(start);
  return (
    <ItemListField
      label="Slides"
      value={value}
      itemLabel="Slide"
      itemLabelAr="شريحة"
      titleKey="alt"
      fields={slideFields()}
      max={8}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const PICTURE = "https://cdn.zimos.test/hero.jpg";

function open(start: Slide = { image: PICTURE }) {
  const onChange = vi.fn<(next: Slide[]) => void>();
  const view = renderWithProviders(<Slides start={[start]} onChange={onChange} />);
  const last = () => onChange.mock.calls.at(-1)?.[0]?.[0] as Slide;
  return { ...view, onChange, last };
}

describe("a slide of the picture slider, with the hero media switch on", () => {
  it("adds the phone's place and the veil right after the computer's place", () => {
    const keys = slideFields().map((field) => field.key);
    const at = keys.indexOf("vertical");
    expect(keys.slice(at + 1, at + 5)).toEqual(["sideMobile", "verticalMobile", "overlay", "overlayMobile"]);
  });

  it("stores nothing for a slide until one of them is touched", () => {
    const { onChange } = open({ image: PICTURE, side: "start", vertical: "top" });
    expect(onChange).not.toHaveBeenCalled();
    // Unset, a phone shows as following the computer.
    expect(screen.getByLabelText("Text sits at, on a phone")).toHaveValue("");
    expect(screen.getByLabelText("Text height, on a phone")).toHaveValue("");
    expect(screen.getByLabelText("Veil over the picture (%)")).toHaveValue(null);
    expect(screen.getByLabelText("Veil on a phone (%)")).toHaveValue(null);
  });

  it("stores a phone's own place, and drops it again for \"same as on a computer\"", async () => {
    const { user, last } = open({ image: PICTURE, side: "start" });
    const side = screen.getByLabelText("Text sits at, on a phone");
    expect(Array.from(side.querySelectorAll("option"), (option) => option.textContent)).toEqual(["Same as on a computer", "Start", "Centre", "End"]);

    await user.selectOptions(side, "End");
    expect(last()).toEqual({ image: PICTURE, side: "start", sideMobile: "end" });

    await user.selectOptions(screen.getByLabelText("Text height, on a phone"), "Top");
    expect(last()).toEqual({ image: PICTURE, side: "start", sideMobile: "end", verticalMobile: "top" });

    await user.selectOptions(side, "Same as on a computer");
    expect(last()).toEqual({ image: PICTURE, side: "start", verticalMobile: "top" });
    expect("sideMobile" in last()).toBe(false);
  });

  it("stores the veil as a whole number from 0 to 60", async () => {
    const { user, last } = open();
    const veil = screen.getByLabelText("Veil over the picture (%)");

    await user.type(veil, "40");
    expect(last()).toEqual({ image: PICTURE, overlay: 40 });

    await user.clear(veil);
    expect(last()).toEqual({ image: PICTURE });

    await user.type(veil, "85");
    await user.tab();
    expect(last()).toEqual({ image: PICTURE, overlay: 60 });

    // The steppers move in fives and stop at the ends.
    await user.click(screen.getByRole("button", { name: "Decrease Veil over the picture (%)" }));
    expect(last()).toEqual({ image: PICTURE, overlay: 55 });
    expect(screen.getByRole("button", { name: "Increase Veil over the picture (%)" })).toBeEnabled();
  });

  it("keeps 0 on a phone as a value of its own, and an emptied field as \"same as on a computer\"", async () => {
    const { user, last } = open({ image: PICTURE, overlay: 40 });
    const phone = screen.getByLabelText("Veil on a phone (%)");

    await user.type(phone, "0");
    expect(last()).toEqual({ image: PICTURE, overlay: 40, overlayMobile: 0 });

    await user.clear(phone);
    expect(last()).toEqual({ image: PICTURE, overlay: 40 });
    expect("overlayMobile" in last()).toBe(false);
  });

  it("names them in Arabic", () => {
    renderWithProviders(
      <EditorLocaleContext.Provider value="ar">
        <Slides start={[{ image: PICTURE }]} onChange={() => undefined} />
      </EditorLocaleContext.Provider>
    );
    const side = screen.getByLabelText("مكان النص على الموبايل");
    expect(side.querySelector("option")?.textContent).toBe("كما على الكمبيوتر");
    expect(screen.getByLabelText("ارتفاع النص على الموبايل")).toBeInTheDocument();
    expect(screen.getByLabelText("طبقة فوق الصورة (%)")).toBeInTheDocument();
    expect(screen.getByLabelText("الطبقة على الموبايل (%)")).toBeInTheDocument();
  });
});

describe("a slide's background video", () => {
  const MB = 1024 * 1024;
  const clip = (id: string, size: number) =>
    fake<MediaAsset>({ id, url: `https://cdn.zimos.test/${id}.mp4`, mimeType: "video/mp4", size, createdAt: "2026-10-01T10:00:00Z" });
  const picture = fake<MediaAsset>({ id: "photo", url: "https://cdn.zimos.test/photo.png", mimeType: "image/png", size: 1200, createdAt: "2026-10-01T09:00:00Z" });
  const HEAVY = /loads slowly for shoppers/;
  const POSTER = /Add the picture too/;

  /** Opens the library from the field and picks the one video it holds. */
  async function pick(user: ReturnType<typeof open>["user"], button = "Choose a video") {
    await user.click(screen.getByRole("button", { name: button }));
    const tiles = await screen.findAllByRole("button", { name: /Use the video uploaded/ });
    expect(tiles).toHaveLength(1);
    await user.click(tiles[0]);
  }

  it("sits with the slide's pictures, and is the only way a video gets in: no address is typed", () => {
    const fields = slideFields();
    const keys = fields.map((field) => field.key);
    expect(keys[keys.indexOf("mobileImageEn") + 1]).toBe("video");
    const video = fields.find((field) => field.key === "video");
    expect(video).toMatchObject({ kind: "video", sizeKey: "videoBytes", posterKey: "image" });

    open();
    expect(screen.getByText("Background video")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a video" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove the video" })).not.toBeInTheDocument();
    // The library is not read until it is asked for.
    expect(api.listMedia).not.toHaveBeenCalled();
  });

  it("is chosen from the media library's videos and stored with its size", async () => {
    api.listMedia.mockResolvedValue({ media: [picture, clip("small", 2 * MB)], nextCursor: null });
    const { user, last } = open();
    await pick(user);
    await waitFor(() => expect(last()).toEqual({ image: PICTURE, video: "https://cdn.zimos.test/small.mp4", videoBytes: 2 * MB }));
    // The library closes a moment after the pick; until then the page behind it is out of reach.
    expect(await screen.findByRole("button", { name: "Change the video" })).toBeInTheDocument();
    expect(screen.queryByText(HEAVY)).not.toBeInTheDocument();
    expect(screen.queryByText(POSTER)).not.toBeInTheDocument();
  });

  it("warns about a file over 8 MB, and stores it all the same", async () => {
    api.listMedia.mockResolvedValue({ media: [clip("big", 9.4 * MB)], nextCursor: null });
    const { user, last } = open();
    await pick(user);
    await waitFor(() => expect(last()).toEqual({ image: PICTURE, video: "https://cdn.zimos.test/big.mp4", videoBytes: 9.4 * MB }));
    expect(screen.getByText(HEAVY)).toHaveTextContent("This video is 9.4 MB. Over 8 MB it loads slowly for shoppers");
  });

  it("goes on warning when the slide is opened again, and says nothing at 8 MB or for an unknown size", () => {
    expect(HEAVY_VIDEO_BYTES).toBe(8 * MB);
    const heavy = open({ image: PICTURE, video: "https://cdn.zimos.test/big.mp4", videoBytes: 12 * MB });
    expect(screen.getByText(HEAVY)).toHaveTextContent("12 MB");
    expect(heavy.onChange).not.toHaveBeenCalled();
    heavy.unmount();

    const exact = open({ image: PICTURE, video: "https://cdn.zimos.test/ok.mp4", videoBytes: 8 * MB });
    expect(screen.queryByText(HEAVY)).not.toBeInTheDocument();
    exact.unmount();

    open({ image: PICTURE, video: "https://cdn.zimos.test/old.mp4" });
    expect(screen.queryByText(HEAVY)).not.toBeInTheDocument();
  });

  it("asks for the slide's picture, which is the video's poster", () => {
    const bare = open({ video: "https://cdn.zimos.test/small.mp4", videoBytes: 2 * MB });
    expect(screen.getByText(POSTER)).toBeInTheDocument();
    bare.unmount();

    // No video, no reminder: a slide without a picture is its own matter.
    const empty = open({});
    expect(screen.queryByText(POSTER)).not.toBeInTheDocument();
    empty.unmount();

    open({ image: PICTURE, video: "https://cdn.zimos.test/small.mp4", videoBytes: 2 * MB });
    expect(screen.queryByText(POSTER)).not.toBeInTheDocument();
  });

  it("replaces the video and its size together, and takes both away together", async () => {
    api.listMedia.mockResolvedValue({ media: [clip("small", 2 * MB)], nextCursor: null });
    const { user, last } = open({ image: PICTURE, video: "https://cdn.zimos.test/big.mp4", videoBytes: 12 * MB });
    expect(screen.getByText(HEAVY)).toBeInTheDocument();

    await pick(user, "Change the video");
    await waitFor(() => expect(last()).toEqual({ image: PICTURE, video: "https://cdn.zimos.test/small.mp4", videoBytes: 2 * MB }));
    expect(screen.queryByText(HEAVY)).not.toBeInTheDocument();

    // The library closes a moment after the pick; until then the page behind it is out of reach.
    await user.click(await screen.findByRole("button", { name: "Remove the video" }));
    expect(last()).toEqual({ image: PICTURE });
    expect("video" in last()).toBe(false);
    expect("videoBytes" in last()).toBe(false);
  });

  it("says it in Arabic", () => {
    renderWithProviders(
      <EditorLocaleContext.Provider value="ar">
        <Slides start={[{ video: "https://cdn.zimos.test/big.mp4", videoBytes: 9.4 * MB }]} onChange={() => undefined} />
      </EditorLocaleContext.Provider>
    );
    expect(screen.getByText("فيديو الخلفية")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تغيير الفيديو" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إزالة الفيديو" })).toBeInTheDocument();
    expect(screen.getByText(/يتأخر تحميله عند العملاء/)).toHaveTextContent("٩٫٤");
    expect(screen.getByText(/أضف الصورة أيضًا/)).toBeInTheDocument();
  });
});

describe("the media library, asked for a video", () => {
  it("hands back the video with its size; a picture is handed back as it always was", async () => {
    const MB = 1024 * 1024;
    const assets = [
      fake<MediaAsset>({ id: "clip", url: "https://cdn.zimos.test/clip.webm", mimeType: "video/webm", size: 5 * MB, createdAt: "2026-10-01T10:00:00Z" }),
      fake<MediaAsset>({ id: "photo", url: "https://cdn.zimos.test/photo.png", mimeType: "image/png", size: 1200, createdAt: "2026-10-01T09:00:00Z" }),
    ];
    api.listMedia.mockResolvedValue({ media: assets, nextCursor: null });

    const onVideo = vi.fn();
    const video = renderWithProviders(<MediaPicker open onOpenChange={vi.fn()} onPick={onVideo} accept="video" />);
    await video.user.click(await screen.findByRole("button", { name: /Use the video uploaded/ }));
    await waitFor(() => expect(onVideo).toHaveBeenCalledWith({ url: "https://cdn.zimos.test/clip.webm", id: "clip", size: 5 * MB }));
    video.unmount();

    const onPicture = vi.fn();
    const image = renderWithProviders(<MediaPicker open onOpenChange={vi.fn()} onPick={onPicture} accept="image" />);
    await image.user.click(await screen.findByRole("button", { name: /Use the picture uploaded/ }));
    await waitFor(() => expect(onPicture).toHaveBeenCalledWith({ url: "https://cdn.zimos.test/photo.png", id: "photo" }));
  });
});
