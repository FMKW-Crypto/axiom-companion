# Axiom Companion

A browser extension that integrates directly into **axiom.trade** — a portfolio
overlay, quick-trade actions, and token-page enrichment injected into the site
itself. Trading and API logic is ported from the Rust SDK
[`axiomtrade-rs`](../axiomtrade-rs) into TypeScript.

See [`PLAN.md`](PLAN.md) for the full design rationale and roadmap.

## Status

V1 implements PLAN phases 0–5: scaffold, API core with auth refresh, MAIN-world
interceptor, portfolio overlay (F1), token enrichment (F3), and quick-trade
buys behind safety rails (F2). All checks pass: 18 unit tests, `svelte-check`
with zero errors, production build, and the Chromium e2e smoke test.

Deliberately deferred from the plan (post-v1): sell presets (buy-only for now),
`meme-trending` rank and `price-feed` momentum in the enrichment strip,
API-reachability health check in the popup, and the live WebSocket feed.

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
never handles credentials. Three moving parts:

- **Background service worker** (`src/entrypoints/background.ts`) owns the single
  `ApiClient` and makes authenticated calls to `api*.axiom.trade`; cookies attach
  automatically via `host_permissions` + `credentials: "include"`, and it
  replays the SDK's refresh-token flow on a 401.
- **MAIN-world interceptor** (`src/entrypoints/interceptor.content.ts`) passively
  observes the page's own `fetch`/`WebSocket` traffic to auto-discover your
  wallet addresses — no configuration — and to detect API schema drift.
- **Content-script UI** (`src/entrypoints/axiom.content/`) mounts the Svelte
  panels inside shadow roots so the FMKW theme never collides with axiom.trade's
  styles.

## What's ported from axiomtrade-rs

| Rust source | TypeScript target |
|---|---|
| `auth/client.rs` (endpoint pool, refresh flow, headers) | `src/lib/api/client.ts` |
| `api/portfolio.rs` (`portfolio-v5`, `batched-sol-balance`) | `src/lib/api/portfolio.ts` |
| `api/trading.rs` (`quote`/`simulate`/`batched-send-tx-v2`, validation) | `src/lib/api/trading.ts` |
| `api/market_data.rs` (`token-analysis`, `clipboard-pair-info`, `price`) | `src/lib/api/market.ts` |
| `utils/{retry,rate_limiter}.rs` | `src/lib/utils/net.ts` |
| `models/{trading,portfolio_v5,market}.rs` | `src/lib/models/*.ts` (zod) |

Deliberately **not** ported: email/OTP/password login, Turnkey session creation,
user-agent rotation — the browser session replaces all of it.

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
pnpm test         # vitest: validation, retry/rate-limit, lenient schemas
pnpm compile      # svelte-check + tsc, zero errors
pnpm test:e2e     # builds, loads the extension in Chromium, asserts it mounts
```

The e2e smoke test (`tests/smoke.mjs`) loads the built extension into a real
Chromium, verifies the service worker registers, the popup renders in the FMKW
theme, and the content script injects its shadow-root panel on an axiom.trade
page. Set `SHOT_DIR=/path` to also capture screenshots.

## Safety

Quick-trade is **off by default** and, when enabled, every buy requires an
explicit in-page confirmation shown after a `/simulate` dry-run, and is bounded
by a per-session SOL spend cap. No credentials are stored, no data leaves the
browser, and there are no external servers. This is a personal-use tool; running
it against your own account carries the same ToS exposure as running the Rust
SDK.
