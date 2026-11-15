import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import type { Locale } from "@/i18n/LocaleContext";

/**
 * The platform's own templates as a merchant should meet them (owner, 2026-11-15:
 * "the stores page shown better, and loading at once").
 *
 * A name for each, by the kind of store it suits — the console names them by
 * their source ("XS 07 عربي"), which says nothing to a merchant — the same
 * names the landing page gives them; a template the console adds later keeps
 * its own name. Its language is the gallery's English / عربي switch, so the
 * name does not repeat it.
 *
 * And a picture of each, taken from the storefront drawing its home page
 * (public/template-thumbs: the top of the page on a desktop, 640x400, and on
 * a phone, 360x480), so the grid shows every template at once instead of
 * rendering each one live. A template with no picture here (one added later)
 * is still drawn live (TemplateLivePreview).
 */
const NAMES: Record<string, Record<Locale, string>> = {
  "Atelier": { ar: "متجر ملابس", en: "Clothing store" },
  "Cradle": { ar: "مستلزمات الأم والطفل", en: "Mother and baby" },
  "XS 01": { ar: "أزياء نسائية", en: "Women's fashion" },
  "XS 01 B": { ar: "أزياء رجالية", en: "Menswear" },
  "XS 01 C": { ar: "أزياء بطابع داكن", en: "Fashion in dark" },
  "XS 02": { ar: "أثاث وديكور", en: "Furniture and decor" },
  "XS 03": { ar: "أزياء عصرية", en: "Modern fashion" },
  "XS 04": { ar: "أزياء وتجميل", en: "Fashion and beauty" },
  "XS 05": { ar: "أزياء رجالية كلاسيك", en: "Classic menswear" },
  "XS 06": { ar: "فساتين وموضة", en: "Dresses and style" },
  "XS 07": { ar: "خضار وفاكهة عضوية", en: "Organic produce" },
  "XS 08": { ar: "أحذية رياضية", en: "Sports shoes" },
  "XS 09": { ar: "وسائد ومفروشات", en: "Pillows and bedding" },
  "XS 10": { ar: "ملابس الشتاء", en: "Winter wear" },
  "XS 11": { ar: "إطلالات أنيقة", en: "Stylish looks" },
  "XS 12": { ar: "ساعات وأجهزة ذكية", en: "Watches and smart devices" },
  "XS 13": { ar: "ساعات ذكية", en: "Smart watches" },
  "XS 14": { ar: "ملابس شبابية", en: "Youth clothing" },
  "XS 15": { ar: "إلكترونيات وكمبيوتر", en: "Electronics and computers" },
  "XS 16": { ar: "ملابس وإكسسوارات", en: "Clothing and accessories" },
  "XS 17": { ar: "فواكه وعصائر", en: "Fruit and juices" },
  "XS 18": { ar: "وجبات سريعة", en: "Fast food" },
  "XS 19": { ar: "مقهى ومطعم", en: "Caf\u00e9 and restaurant" },
  "XS 20": { ar: "مشويات", en: "Grill house" },
  "XS 21": { ar: "مطعم فاخر", en: "Fine dining" },
  "XS 22": { ar: "خدمات وأعمال", en: "Services and business" },
};

/** The templates that have a picture in public/template-thumbs, by id. */
const PICTURED: ReadonlySet<string> = new Set([
  "01416494-a80a-437b-aa6c-de5835065b8a",
  "046dc0a5-8922-4080-a6a2-a7aa6ccc73ec",
  "0ab2955e-5ad8-497a-befb-429377daae36",
  "0b51e386-f47b-43f4-af3d-3b1bb1812d51",
  "0e1c366d-94f7-4028-a42d-8db97a209c35",
  "13bbfa48-1be6-4cb8-b128-1680ee4f9507",
  "177321b1-ec2e-46bf-967e-0b35c85b02eb",
  "1af9afad-c843-4edc-8a11-1203338d2840",
  "1b02ca13-d86c-4621-840f-dc34e6fa860c",
  "22e1a088-bd95-475d-a5a9-94aa4b204ef8",
  "2714dcb7-bc49-4637-b27b-99649d433cc6",
  "29cc1d94-d6e9-4dc4-9300-9dab95d06e01",
  "3c585a91-3dcf-43e1-86e3-f78c67879c73",
  "4152a12d-29a4-4fd0-b245-7c679c720053",
  "44d982d5-e28d-4fdb-a71a-e49e1190b68a",
  "4d25e814-f2f4-41b8-a30d-9ed260385e6f",
  "510c00d1-4c3d-46a8-8658-a9bdda250da1",
  "5289cf04-7b16-4551-ad76-415535cbe188",
  "538398a8-cbfe-4605-a640-1c740fd79b8c",
  "53ef7652-288b-4747-8816-9ca0faf9bb41",
  "53effc5b-304e-4add-816c-faa8e76c14b3",
  "56af48bc-33fb-47a4-b9d9-88e57850036d",
  "5728b02c-91d1-4e32-9df4-2766ecc758b6",
  "5916fa6f-f9b5-4949-95b2-f0afed116962",
  "5966e866-ea21-4334-8825-ac49034bf312",
  "5ef42ce7-0efd-4774-a443-7bd13e6991fb",
  "5fbdca89-be77-4ea9-bf9c-48f954cd378b",
  "68eaa0e3-af3f-46b1-b5fb-315811f7fca5",
  "6ec51c49-d87b-43c2-a92d-fdb5628ec70d",
  "74233194-f42b-43e6-9c15-4ff4ad589a5a",
  "7489c5ae-937e-478f-82d0-2760957e39b1",
  "78a4ff00-1181-47f1-9f23-289cbf0fcb35",
  "7b53779d-81f3-4622-b0a3-f3a28e667002",
  "824d76e7-c65b-4f03-b0bb-236d4dfcde45",
  "8a08526a-6055-4bc2-9a92-c38dfb3bc54c",
  "8c007deb-332c-4459-a882-76a385193a92",
  "8dd6b500-d3b9-4633-920d-1c587aaa104b",
  "95853fed-71ae-4925-97ed-5f346a4e9412",
  "ab2cab4d-e814-4460-b1bb-aee6bda69389",
  "aedb3e9f-e731-4f05-9471-1ff342ce03c3",
  "bd3c1e81-813e-4630-a5cb-f138043cc912",
  "bdb526c5-6f3c-4b8c-83ed-462a3da1bf49",
  "c0e07ded-57a6-4320-9ed8-11a510751abc",
  "c1f6629d-57ea-4806-968d-43a82cf5bf62",
  "c4f27634-6ad6-44d7-ad92-b90b651dfb58",
  "c68a5ca3-49d4-4283-9ce6-8165a30c7d90",
  "ca9b2fc5-32fa-44aa-903c-2dc689a75850",
  "dbbc1a26-1079-4d21-beb0-89506cdc907f",
  "e658c085-ab5e-486f-8b87-da7488465766",
  "ed7b34c2-ed9d-49bc-8dac-d9572f9419cb",
  "ee7511e5-5a98-47b5-a7ad-d501ba18d327",
  "ef8df9d0-e2e8-43a0-9529-b3220402632f",
]);

/** A template's name for the merchant: the kind of store it suits, or the console's own name for one not listed. */
export function templateName(template: Pick<WebsiteTemplateSummary, "name">, locale: Locale): string {
  const base = template.name.replace(/\s+عربي$/, "").trim();
  return NAMES[base]?.[locale] ?? template.name;
}

/** The template's own picture (the console's) if it has one, else ours, else null: then it is drawn live. */
export function templatePicture(template: Pick<WebsiteTemplateSummary, "id" | "thumbnailUrl">, layout: "desktop" | "mobile"): string | null {
  if (template.thumbnailUrl) return template.thumbnailUrl;
  return PICTURED.has(template.id) ? `/template-thumbs/${template.id}-${layout === "desktop" ? "desk" : "phone"}.webp` : null;
}
