import { fontAlias, fontFitsRole, fontUses, type FontPair } from "@store-builder/ui/fonts";
import { getFontFaces, getFontIndex } from "@/lib/storeFonts.server";

/**
 * The @font-face rules for the fonts a part of the page picked (lib/storeFonts.ts):
 * one small `<style>` per face, which React hoists into <head> and writes once
 * however many parts of the page name the same face (`href` + `precedence`).
 * Renders nothing — and asks nothing of the API or Google — for a store that
 * picked no font, which is every store until its merchant does.
 */
export async function StoreFontFaces({ pairs }: { pairs: Array<FontPair | null | undefined> }) {
  const uses = fontUses(...pairs);
  if (uses.length === 0) return null;
  const index = await getFontIndex();
  const rules = await Promise.all(
    uses.map(async ({ role, id }) => {
      const font = index.get(id);
      if (!font || !fontFitsRole(font, role)) return null;
      const css = await getFontFaces(font, role);
      return css ? { href: fontAlias(role, id), css } : null;
    })
  );
  const found = rules.filter((rule): rule is { href: string; css: string } => rule !== null);
  if (found.length === 0) return null;
  return (
    <>
      {/* The font files' origin, connected to while the page is still being read (React puts it in <head>). */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {found.map(({ href, css }) => (
        <style key={href} href={href} precedence="zf-fonts">
          {css}
        </style>
      ))}
    </>
  );
}
