# ZIMOS brand assets

Generated from the final logo exports (`logooo full.png`, `logo z.png`). Never
redraw, retype, stretch, rotate, outline or add effects.

Both source files carry real alpha, so every asset here is a plain transparent
PNG — render it with `<img>`/`<Image>` on any surface. **No blend modes, no
background-colour workarounds.**

## Full lockup

| file | use |
| --- | --- |
| `zimos-logo-light.png` | light surfaces — navy `#0B1F66` wordmark |
| `zimos-logo-dark.png`  | dark surfaces — white wordmark |

Two variants are required. The wordmark is a flat brand navy, so the light file
is effectively invisible on a dark surface; the dark file is the brand's
approved reversed lockup (white wordmark, mark unchanged). Both are cropped to
the identical ink bounding box, so the same rendered `height` gives the same
optical size — no per-variant nudging.

## Mark

| file | use |
| --- | --- |
| `zimos-mark.png` | bare transparent Z, 512px square |
| `zimos-mark-tile.png` | the mark on its white app-icon tile, 512px |
| `zimos-icon-{16,32,180,192,512}.png` | bare transparent Z — favicons, apple-touch, PWA/manifest |
| `favicon.ico` | 16/32/48 multi-size, for `<link rel="icon">` |

Every `zimos-icon-*.png` and `favicon.ico` here is the **bare transparent mark**,
resized from `zimos-mark.png` with lanczos3 — no white tile. The mark's ink is
mid-luminance blue (`#0080e0` and neighbours), so it reads against both light and
dark browser chrome at favicon sizes. `zimos-mark-tile.png` keeps the white
app-icon tile for anywhere a solid tile is still wanted.

Two things to know:
  - `favicon.ico` is a PNG-in-ICO container at 16/32/48, so it carries alpha.
  - iOS does not honour alpha in `apple-touch-icon`: it composites the 180 over
    black, so a home-screen shortcut shows the blue Z on a black tile. Point
    `apple-touch-icon` at a tile-based export if that matters. The dashboard
    does since 2026-10-28: see "The dashboard's app icons" below.

Apps serve these two ways. The Next apps (marketing, storefront) use the file
convention — `src/app/icon.png`, `apple-icon.png`, `favicon.ico` — and need no
`<link>` tags. The Vite apps (merchant-dashboard, platform-admin) have no such
convention, so they carry `public/icon.png` and `public/apple-icon.png` and link
them explicitly from `index.html`.

## The dashboard's app icons

The merchant dashboard's home-screen shortcut and installed app, in
`apps/merchant-dashboard/public/` (made from `zimos-mark.png` with lanczos3):

| file | size | background | the Z | used by |
| --- | --- | --- | --- | --- |
| `apple-touch-icon.png` | 180 | solid white `#FFFFFF`, no alpha channel | 55% of the side, centred | `<link rel="apple-touch-icon">` (iOS) |
| `icon-192.png`, `icon-512.png` | 192, 512 | transparent | 55%, centred | manifest, `purpose: "any"` |
| `icon-maskable-512.png` | 512 | solid white, no alpha channel | 45%, centred (inside the circle Android cuts) | manifest, `purpose: "maskable"` |

The dashboard links `/apple-touch-icon.png` instead of `public/apple-icon.png`,
which stays for nothing that links it. The console and the store's own app icon
(Store settings → Store app) are not affected. `src/lib/appIcons.test.ts` checks
the manifest, the link, the sizes and which files carry alpha.
