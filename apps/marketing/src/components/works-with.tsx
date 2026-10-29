/* eslint-disable @next/next/no-img-element -- the platforms' own small marks, drawn as-is. */
import type { Dictionary } from "@/i18n/dictionary";
import { ColorIcon, type ColorIconName } from "./color-icon";

type Platform =
  | {
      name: string;
      src: string;
      kind?: "full" | "word";
      /** Taken by hand, not through an API. */
      tag?: "manual";
    }
  /** Words instead of brands: no shipping company or payment gateway is named on the site. */
  | { icon: ColorIconName; label: "shippingCompanies" | "paymentGateways" };

/**
 * Each platform with its own mark (public/integrations): Simple Icons (CC0)
 * for WhatsApp, Facebook, TikTok and Snapchat, and the official files for
 * Google and InstaPay. `full` marks are a filled square already; `word`
 * marks are the name itself, so no name is written beside them.
 *
 * Shipping companies and payment gateways are named nowhere on the site
 * (the owner's marketing rules, 2026-10-28): the strip says "every shipping
 * company" and "payment gateways" with the site's own icons. InstaPay is a
 * manual transfer the customer sends proof of.
 */
const PLATFORMS: Platform[] = [
  { name: "WhatsApp", src: "whatsapp.svg" },
  { name: "Facebook", src: "facebook.svg" },
  { name: "TikTok", src: "tiktok.svg" },
  { name: "Snapchat", src: "snapchat.svg", kind: "full" },
  { name: "Google", src: "google.png" },
  { icon: "delivery", label: "shippingCompanies" },
  { icon: "card", label: "paymentGateways" },
  { name: "InstaPay", src: "instapay.png", kind: "word", tag: "manual" },
];

/**
 * The strip under the hero. The list is written four times and the track
 * moves by half its width — two laps, so even the widest screen never
 * reaches the end of a half — and it loops without a jump; the copies are
 * hidden from screen readers, and without motion they are not shown at all.
 * InstaPay says it is a manual transfer.
 */
export function WorksWith({ copy }: { copy: Dictionary["integrations"] }) {
  const items = (lap: number) =>
    PLATFORMS.map((platform) => {
      const duplicate = lap > 0;
      if ("icon" in platform) {
        return (
          <li key={`${platform.label}-${lap}`} aria-hidden={duplicate || undefined}>
            <span className="lz-logo">
              <ColorIcon name={platform.icon} size={18} />
            </span>
            <span>{copy[platform.label]}</span>
          </li>
        );
      }
      const { name, src, kind, tag } = platform;
      const logo = ["lz-logo", kind && `lz-logo--${kind}`].filter(Boolean).join(" ");
      return (
        <li key={`${name}-${lap}`} aria-hidden={duplicate || undefined}>
          <span className={logo}>
            <img src={`/integrations/${src}`} alt={kind === "word" ? name : ""} loading="lazy" decoding="async" />
          </span>
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
    <div className="lz-strip" role="region" aria-label={copy.label}>
      <div className="lz-in lz-strip__in">
        <span className="lz-strip__t">{copy.label}</span>
        <div className="lz-marquee">
          <ul className="lz-marquee__track">{[0, 1, 2, 3].map(items)}</ul>
        </div>
      </div>
      <p className="lz-strip__note">{copy.note}</p>
    </div>
  );
}
