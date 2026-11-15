import { describe, expect, it } from "vitest";
import { templateName, templatePicture } from "./templateNames";

describe("the platform's templates as a merchant meets them", () => {
  it("names a built-in template by the kind of store it suits, in the dashboard's language, without «عربي»", () => {
    expect(templateName({ name: "XS 07 عربي" }, "ar")).toBe("خضار وفاكهة عضوية");
    expect(templateName({ name: "XS 07" }, "en")).toBe("Organic produce");
    expect(templateName({ name: "Atelier عربي" }, "ar")).toBe("متجر ملابس");
  });

  it("keeps the console's own name for a template it does not know", () => {
    expect(templateName({ name: "Bloom" }, "ar")).toBe("Bloom");
  });

  it("shows the console's thumbnail first, else ours by id and layout, else none (drawn live)", () => {
    const atelier = "538398a8-cbfe-4605-a640-1c740fd79b8c";
    expect(templatePicture({ id: atelier, thumbnailUrl: "https://cdn.example/t.webp" }, "desktop")).toBe("https://cdn.example/t.webp");
    expect(templatePicture({ id: atelier, thumbnailUrl: null }, "desktop")).toBe(`/template-thumbs/${atelier}-desk.webp`);
    expect(templatePicture({ id: atelier, thumbnailUrl: null }, "mobile")).toBe(`/template-thumbs/${atelier}-phone.webp`);
    expect(templatePicture({ id: "tpl_new", thumbnailUrl: null }, "desktop")).toBeNull();
  });
});
