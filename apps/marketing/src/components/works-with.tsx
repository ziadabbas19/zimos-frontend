/* eslint-disable @next/next/no-img-element -- the platforms' own small marks, drawn as-is. */
import type { Dictionary } from "@/i18n/dictionary";

type Platform = {
  name: string;
  src: string;
  kind?: "full" | "word";
  /** A mark drawn for a dark ground (white lettering), on a dark tile. */
  dark?: true;
  /** `soon`: not connected yet. `manual`: taken by hand, not through an API. */
  tag?: "soon" | "manual";
};

/**
 * Each platform with its own mark (public/integrations): the official files
 * from each company's site, Wikimedia Commons for the Aramex and J&T
 * wordmarks, and Simple Icons (CC0) for WhatsApp, Facebook, TikTok and
 * Snapchat. `full` marks are a filled square already; `word` marks are the
 * name itself, so no name is written beside them. Aramex is off the strip
 * until there is an Aramex courier to connect (the owner, 2026-10-23); its
 * file stays in public/integrations.
 *
 * Added 2026-10-23 from each company's own site, resized only (none of the
 * three is on Wikimedia Commons or Simple Icons, and the sites state no
 * licence for them):
 *   mylerz.png   www.mylerz.com's touch icon:
 *                https://cdn.prod.website-files.com/651c198b3ea329eb422858f1/683d9be20211b85dfa78b66c_hhhhhj.png
 *   kashier.png  www.kashier.io's icon: https://www.kashier.io/icon.png
 *   turbo.png    the header wordmark of https://turbo.info (Turbo Logistics),
 *                white for its dark header, so it sits on a dark tile
 *
 * Paymob and Kashier are the gateways a merchant connects under Payments;
 * InstaPay is a manual transfer the customer sends proof of.
 */
const PLATFORMS: Platform[] = [
  { name: "WhatsApp", src: "whatsapp.svg" },
  { name: "Facebook", src: "facebook.svg" },
  { name: "TikTok", src: "tiktok.svg" },
  { name: "Snapchat", src: "snapchat.svg", kind: "full" },
  { name: "Google", src: "google.png" },
  { name: "Bosta", src: "bosta.png", kind: "full" },
  { name: "J&T Express", src: "jt-express.png", kind: "full" },
  { name: "Mylerz", src: "mylerz.png" },
  { name: "Turbo", src: "turbo.png", kind: "word", dark: true, tag: "soon" },
  { name: "Paymob", src: "paymob.png" },
  { name: "Kashier", src: "kashier.png" },
  { name: "InstaPay", src: "instapay.png", kind: "word", tag: "manual" },
];

/**
 * The strip under the hero. The list is written twice and the track moves
 * by half its width, so it loops without a jump; the copy is hidden from
 * screen readers, and without motion it is not shown at all. A platform not
 * connected yet carries "Soon"; InstaPay says it is a manual transfer.
 */
export function WorksWith({ copy }: { copy: Dictionary["integrations"] }) {
  const items = (duplicate: boolean) =>
    PLATFORMS.map(({ name, src, kind, dark, tag }) => {
      const logo = ["lz-logo", kind && `lz-logo--${kind}`, dark && "lz-logo--dark"].filter(Boolean).join(" ");
      return (
        <li key={`${name}-${duplicate}`} aria-hidden={duplicate || undefined} className={tag === "soon" ? "is-soon" : undefined}>
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
          {tag === "soon" ? <span className="lz-soon">{copy.soon}</span> : null}
        </li>
      );
    });

  return (
    <div className="lz-strip" role="region" aria-label={copy.label}>
      <div className="lz-in lz-strip__in">
        <span className="lz-strip__t">{copy.label}</span>
        <div className="lz-marquee">
          <ul className="lz-marquee__track">
            {items(false)}
            {items(true)}
          </ul>
        </div>
      </div>
      <p className="lz-strip__note">{copy.note}</p>
    </div>
  );
}
