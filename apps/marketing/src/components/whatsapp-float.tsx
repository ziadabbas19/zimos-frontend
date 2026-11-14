import type { CSSProperties } from "react";
import { socialLinksOf, type PublicPlatformSettings } from "@store-builder/ui/platform-info";
import { socialLinkLabel, visibleSocialLinks } from "@store-builder/ui/social-links";
import type { Locale } from "@/i18n/config";

/**
 * A way to ask before signing up: ZIMOS's own WhatsApp chat (the account the
 * footer links, the console's when saved), as a round button at the corner
 * of the home page. Not drawn while there is no such account.
 */
export function WhatsAppFloat({ settings, locale }: { settings: PublicPlatformSettings | null; locale: Locale }) {
  const chat = visibleSocialLinks(socialLinksOf(settings)).find((link) => link.platform === "whatsapp");
  if (!chat) return null;
  const mark = { "--ci": "url(/integrations/whatsapp.svg)", inlineSize: 30, blockSize: 30 } as CSSProperties;
  return (
    <a className="zx-wa" href={chat.href} target="_blank" rel="noopener noreferrer" aria-label={socialLinkLabel(chat, locale)}>
      <span className="ci ci--ink" style={mark} aria-hidden />
    </a>
  );
}
