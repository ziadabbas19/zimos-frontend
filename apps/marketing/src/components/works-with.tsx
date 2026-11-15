/* eslint-disable @next/next/no-img-element -- the platforms' own small marks, drawn as-is. */
import type { Dictionary } from "@/i18n/dictionary";
import type { Icon3DName } from "./icon-3d";

type Platform =
  | {
      name: string;
      src: string;
      kind?: "full" | "word";
      /** Taken by hand, not through an API. */
      tag?: "manual";
    }
  /** Words instead of brands: no shipping company or payment gateway is named on the site. */
  | { icon: Icon3DName; label: "shippingCompanies" | "paymentGateways" };

/**
 * Each platform with its own mark (public/integrations): Simple Icons (CC0)
 * for WhatsApp, Facebook, TikTok and Snapchat, and the official files for
 * Google and InstaPay. `word` marks are the name itself, so no name is
 * written beside them.
 *
 * Shipping companies and payment gateways are named nowhere on the site
 * (the owner's marketing rules, 2026-10-28): the strip says "every shipping
 * company" and "payment gateways" with the site's own pictures
 * (public/icons/3d). InstaPay is a manual transfer the customer sends proof of.
 */
const PLATFORMS: Platform[] = [
  { name: "WhatsApp", src: "whatsapp.svg" },
  { name: "Facebook", src: "facebook.svg" },
  { name: "TikTok", src: "tiktok.svg" },
  { name: "Snapchat", src: "snapchat.svg", kind: "full" },
  { name: "Google", src: "google.png" },
  { icon: "truck", label: "shippingCompanies" },
  { icon: "card", label: "paymentGateways" },
  { name: "InstaPay", src: "instapay.png", kind: "word", tag: "manual" },
];

/**
 * The strip under the hero, moving slowly sideways (the other way in
 * Arabic) and holding still under the pointer. The list is written four
 * times and the track moves by half its width, so even the widest screen
 * never reaches its end and it loops without a jump; the copies are hidden
 * from screen readers, and without motion they are not shown at all.
 */
export function WorksWith({ copy }: { copy: Dictionary["integrations"] }) {
  const items = (lap: number) =>
    PLATFORMS.map((platform) => {
      const copyOf = lap > 0 || undefined;
      if ("icon" in platform) {
        return (
          <li key={`${platform.label}-${lap}`} className="zm-brand" aria-hidden={copyOf}>
            <img src={`/icons/3d/${platform.icon}.webp`} width={26} height={26} alt="" loading="lazy" decoding="async" />
            <span>{copy[platform.label]}</span>
          </li>
        );
      }
      const { name, src, kind, tag } = platform;
      return (
        <li key={`${name}-${lap}`} className={kind === "word" ? "zm-brand zm-brand--word" : "zm-brand"} aria-hidden={copyOf}>
          <img src={`/integrations/${src}`} height={26} width={kind === "word" ? 72 : 26} alt={kind === "word" ? name : ""} loading="lazy" decoding="async" />
          {tag === "manual" ? (
            <span>{copy.manualTransfer}</span>
          ) : kind === "word" ? null : (
            <span lang="en" dir="ltr">
              {name}
            </span>
          )}
        </li>
      );
    });

  return (
    <div className="zm-works" role="region" aria-label={copy.label}>
      <div className="zm-works-row">
        <span className="zm-works-l">{copy.label}</span>
        <div className="zm-works-vp">
          <ul className="zm-works-t">{[0, 1, 2, 3].map(items)}</ul>
        </div>
      </div>
      <p className="zm-note">{copy.note}</p>
    </div>
  );
}
