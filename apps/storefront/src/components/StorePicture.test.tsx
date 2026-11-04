import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/** NEXT_PUBLIC_STORE_IMAGE_ORIGINS is read as the module loads, so each case loads it afresh. */
async function load(origins?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_STORE_IMAGE_ORIGINS", origins ?? "");
  return import("./StoreImage");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const PHOTO = "https://media.example.com/w/hero.jpg";
const PHONE = "https://media.example.com/w/hero-phone.jpg";
const OTHER = "https://elsewhere.example.com/hero.jpg";

describe("StorePicture", () => {
  it("with no origin listed is the same <picture> of the original files as before", async () => {
    const { StorePicture } = await load();
    expect(
      renderToStaticMarkup(
        <StorePicture src={PHOTO} mobileSrc={PHONE} media="(max-width: 749px)" alt="Hero" width={2400} height={926} sizes="100vw" loading="eager" fetchPriority="high" decoding="async" draggable={false} />,
      ),
    ).toBe(
      `<picture><source media="(max-width: 749px)" srcSet="${PHONE}"/><img src="${PHOTO}" alt="Hero" width="2400" height="926" loading="eager" fetchPriority="high" decoding="async" draggable="false"/></picture>`,
    );
    expect(renderToStaticMarkup(<StorePicture src={PHOTO} media="(max-width: 749px)" alt="" width={10} height={10} sizes="100vw" />)).toBe(
      `<picture><img src="${PHOTO}" alt="" width="10" height="10"/></picture>`,
    );
  });

  it("with the origin listed resizes both files, the phone's for phones", async () => {
    const { StorePicture } = await load("https://media.example.com");
    const html = renderToStaticMarkup(
      <StorePicture src={PHOTO} mobileSrc={PHONE} media="(max-width: 749px)" alt="Hero" width={2400} height={926} sizes="100vw" loading="eager" />,
    );
    expect(html).toContain('media="(max-width: 749px)"');
    expect(html).toContain(`/_next/image?url=${encodeURIComponent(PHONE)}`);
    expect(html).toContain(`/_next/image?url=${encodeURIComponent(PHOTO)}`);
    expect(html).toContain('sizes="100vw"');
    expect(html).toContain('loading="eager"');
  });

  it("leaves a file on any other origin as it is", async () => {
    const { StorePicture } = await load("https://media.example.com");
    const html = renderToStaticMarkup(<StorePicture src={OTHER} media="(max-width: 749px)" alt="" width={10} height={10} sizes="100vw" />);
    expect(html).toBe(`<picture><img src="${OTHER}" alt="" width="10" height="10"/></picture>`);
  });
});
