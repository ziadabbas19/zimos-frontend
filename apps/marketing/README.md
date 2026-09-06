# marketing

The public marketing site for Zimos, served at the domain root (`zimos.co`).
Next.js (App Router), Tailwind v4, no auth, no dynamic data.

Separate from `apps/storefront` (the per-merchant shops): this app owns only
the top-level marketing pages and links out to `app.zimos.co` for register /
login. It never links to platform-admin — that tool is staff-only, reached by
direct URL.

## Internationalization

Two locales, routed by the first path segment:

- `ar` — Arabic, **default**, RTL (`<html dir="rtl">`)
- `en` — English, LTR

All routes live under `src/app/[locale]/…`. `src/proxy.ts` redirects
locale-less requests (`/`, `/pricing`, …) to a locale, preferring the
visitor's `Accept-Language` and falling back to `ar`.

Copy lives in typed dictionaries at `src/i18n/dictionaries/{ar,en}.ts`
(shape enforced by the `Dictionary` interface in `src/i18n/dictionary.ts`).
Server components call `getDictionary(locale)`; client components read the
active dictionary via `useI18n()` from `src/i18n/provider.tsx`.

## Theming

Light/dark via a `.dark` class on `<html>`. The palette is defined as CSS
custom properties in `src/app/globals.css` that flip under `.dark`, exposed
to Tailwind through `@theme inline`. An inline script in the root layout
sets the class before first paint (no flash); the choice is persisted to
`localStorage` and defaults to the system `prefers-color-scheme`.

## Fonts

Loaded with `next/font/google` in `src/app/fonts.ts`. The active
heading/body pairing is chosen by the `lang-*` class the root layout puts on
`<html>` — never per component:

| | Headings | Body |
| --- | --- | --- |
| `en` | Fraunces | Plus Jakarta Sans |
| `ar` | Noto Kufi Arabic | IBM Plex Sans Arabic |

## Scripts

```bash
npm run dev -w apps/marketing      # http://localhost:3000
npm run build -w apps/marketing
npm run start -w apps/marketing
```

From the repo root: `npm run dev:marketing` / `npm run build:marketing`.
