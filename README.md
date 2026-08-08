# Axiom Companion

A browser extension that integrates directly into **axiom.trade** — a token-page
enrichment panel injected into the site itself, showing creator risk, rug count,
and token metadata next to the chart. API logic is ported from the Rust SDK
[`axiomtrade-rs`](../axiomtrade-rs) into TypeScript. The extension is strictly
**read-only**: it never places trades.

See [`PLAN.md`](PLAN.md) for the full design rationale and roadmap.

## Status

V1 implements the PLAN's scope: scaffold, API core with auth refresh, and the
token-enrichment panel. All checks pass: unit tests, `svelte-check` with zero
errors, production build, and the Chromium e2e smoke test.

Deliberately deferred from the plan (post-v1): `meme-trending` rank and
`price-feed` momentum in the enrichment strip, and an API-reachability health
check in the popup.

## Stack

- **[WXT](https://wxt.dev)** — MV3 web-extension framework (Vite, cross-browser).
- **Svelte 5** + **Tailwind v4** — injected UI, mounted in shadow roots.
- **FMKW design system** — the semantic tokens, square corners (`--radius: 0`)
  and self-hosted Oxanium / Space Grotesk / Geist Mono of `../FMKW/apps/web` are
  vendored into `src/lib/styles`, so the extension looks native to the FMKW
  product family. `theme.css` is a mirror of the web app's `styles.css`; edit
  `palette.css` to reskin.
- **Zod** — runtime validation of Axiom API responses (they drift; the schemas
  are lenient and report drift rather than crashing).

## How it works

The extension **rides the axiom.trade session you're already logged into** — it
never handles credentials. Two moving parts:

- **Background service worker** (`src/entrypoints/background.ts`) owns the single
  `ApiClient` and makes authenticated calls to `api*.axiom.trade`; cookies attach
  automatically via `host_permissions` + `credentials: "include"`, and it
  replays the SDK's refresh-token flow on a 401.
- **Content-script UI** (`src/entrypoints/axiom.content/`) detects the token
  from the page URL and mounts the Svelte panel inside a shadow root so the
  FMKW theme never collides with axiom.trade's styles. The panel only appears
  on token pages, anchored at the top of the site's own right sidebar — found
  geometrically (`src/lib/sidebar.ts`), since axiom.trade has no stable
  selectors — and falling back to a floating top-right overlay when no sidebar
  exists (narrow windows, redesigns).

## What's ported from axiomtrade-rs

| Rust source | TypeScript target |
|---|---|
| `auth/client.rs` (endpoint pool, refresh flow, headers) | `src/lib/api/client.ts` |
| `api/market_data.rs` (`token-analysis`, `clipboard-pair-info`, `price`) | `src/lib/api/market.ts` |
| `utils/{retry,rate_limiter}.rs` | `src/lib/utils/net.ts` |
| `models/market.rs` | `src/lib/models/market.ts` (zod) |

Deliberately **not** ported: the trading and portfolio endpoints, email/OTP/
password login, Turnkey session creation, user-agent rotation — the extension
only reads token data, and the browser session replaces the login machinery.

## Develop

```bash
pnpm install
pnpm dev          # launches Chromium with the extension loaded (HMR)
pnpm build        # production build → .output/chrome-mv3
pnpm zip          # store-ready artifact
```

To load manually: `chrome://extensions` → Developer mode → **Load unpacked** →
select `.output/chrome-mv3`.

## Test

```bash
pnpm test         # vitest: token detection, retry/rate-limit, lenient schemas
pnpm compile      # svelte-check + tsc, zero errors
pnpm test:e2e     # builds, loads the extension in Chromium, asserts it mounts
```

The e2e smoke test (`tests/smoke.mjs`) loads the built extension into a real
Chromium, verifies the service worker registers, the popup renders in the FMKW
theme, and the content script injects its shadow-root panel on an axiom.trade
token page. Set `SHOT_DIR=/path` to also capture screenshots.

## Safety

The extension is **read-only**: it displays token data and has no code path
that places, signs, or submits a trade. No credentials are stored, no data
leaves the browser, and there are no external servers. This is a personal-use
tool; running it against your own account carries the same ToS exposure as
running the Rust SDK's read APIs.
