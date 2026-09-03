# Store Builder — Frontend

Three apps that talk to the [store-builder-backend](../store-builder-backend) API, sharing two internal packages.

```
store-builder-frontend/
  apps/
    merchant-dashboard/   React (Vite) — the tool merchants use to run their store. Auth-gated.
    platform-admin/       React (Vite) — internal tool for the Store Builder team. Auth-gated, platformAdmin only.
    storefront/            Next.js — the public, customer-facing shop. No auth; SEO-oriented.
  packages/
    api-client/            Shared TS client for the backend API (auth, tokens w/ auto-refresh, workspaces, public storefront).
    ui/                     Shared shadcn-style UI kit (Button, Input, Label, Card, Alert, Spinner) on one design system.
```

## Why three apps instead of one

- **merchant-dashboard** and **platform-admin** are both behind auth, have no SEO needs, and are heavy on interactivity — a plain SPA (Vite) is the simplest, fastest thing to build and iterate on.
- **storefront** is public, needs real SEO (product pages, OG tags), and will eventually route by custom domain / subdomain per workspace — Next.js's SSR and middleware are built for exactly that. It talks only to the backend's public `/store/:workspaceId/...` API, never the authed merchant API — this matches how the backend README describes the intended split.

## Prerequisites

- Node.js 20+ (built and tested on Node 22)
- The backend running locally (see `store-builder-backend/README.md`). Default expected at `http://localhost:4000/api/v1`.

## Getting started

```bash
npm install        # installs all three apps + both shared packages (npm workspaces)
```

Each app has an `.env.example` — copy it to `.env` (Vite apps) or `.env.local` (Next.js) and point `VITE_API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` at your backend if it's not on the default port.

```bash
npm run dev:dashboard   # http://localhost:5173 — merchant dashboard
npm run dev:admin       # http://localhost:5174 — platform admin
npm run dev:storefront  # http://localhost:3000 — storefront (open /store/<a real workspaceId>)
```

Run all three in separate terminals — a merchant needs to register + build a catalog in the dashboard before there's anything to see in the storefront.

## Build

```bash
npm run build:all
# or individually: build:dashboard / build:admin / build:storefront
```

All three currently build clean with zero TypeScript errors.

## What's implemented so far

- **api-client**: full auth flow (register/login/refresh/logout/me), workspace list/create, admin workspace list, and the public storefront endpoints (store meta, product list, product detail, collections) — response shapes were taken directly from the backend's controllers/services, not guessed from the Postman collection.
- **merchant-dashboard**: register → login → pick/create a workspace → dashboard shell with sidebar nav. All non-auth sections (Orders, Catalog, Customers, Discounts, Shipping & Tax, Website, Funnels, Settings) are wired into routing as placeholders, ready to build out.
- **platform-admin**: login gated on the `platformAdmin` flag, workspaces table (`GET /admin/workspaces`), overview placeholder.
- **storefront**: store home page (branding + product grid) and a product detail page, both server-rendered against the live public API. Path-based routing (`/store/:workspaceId`) for now — custom-domain/subdomain routing via middleware is a deliberate next step, not yet built.

## Known gaps / next steps

- No Cart or Checkout flow yet on the storefront (`X-Cart-Token` handling, Idempotency-Key on order creation).
- Password reset UI is a placeholder — the backend already supports both email and SMS reset.
- Catalog, Orders, Customers, etc. dashboards are placeholders — the API client has no methods for them yet either.
- No middleware-based custom-domain resolution on the storefront yet (currently path-based only).
- No test suite yet.

## Design system

Both React apps and the storefront share one visual language ("Nile & Souk" — deep teal + warm amber, `Fraunces` for display type, `Plus Jakarta Sans` for UI text) defined via Tailwind v4 `@theme` tokens in each app's global CSS. The shared `@store-builder/ui` package builds on top of those tokens, so any Tailwind utility class (`bg-primary`, `text-ink-soft`, etc.) works in all three apps as long as the app defines the same `@theme` block.
