# Axiom Companion — Browser Extension Plan

A browser extension that integrates directly into **axiom.trade**, enriching the site with a portfolio overlay and token-page enrichment — strictly read-only. API logic is ported from the Rust SDK at `../axiomtrade-rs` (TypeScript rewrite, not FFI/WASM — see "Why not WASM" below).

**Status: PLANNING — do not implement until approved.**

---

## 1. Stack (decided 2026-08-08)

| Concern | Choice | Why |
|---|---|---|
| Extension framework | **WXT** (v0.20.x) | Actively maintained (weekly releases), Vite-based, cross-browser (Chrome/Firefox/Edge/Safari), MV3, file-based entrypoints, built-in `createShadowRootUi` for injecting styled UI into pages without CSS collisions, `storage` and messaging helpers. The 2026 consensus over Plasmo (stalled) and CRXJS (Chrome-only plugin). |
| UI library | **Svelte 5** + **Tailwind v4** + **shadcn-svelte** | Small bundles + fast injected UI; WXT has an official Svelte module. shadcn-svelte is Svelte 5 runes-native and Tailwind v4-native, and shares shadcn/ui's semantic token contract — so the FMKW design system drops in (see §1b). |
| Language | TypeScript (strict) | Type-safe port of the Rust models. |
| Data models/validation | **Zod** schemas mirroring `axiomtrade-rs/src/models/*` | API responses drift; runtime validation catches it instead of silent `undefined`s. |
| State | Svelte runes + `wxt/storage` for persistence | No extra state lib needed. |
| Package manager | pnpm | Fast, standard with WXT. |
| Tests | Vitest (WXT has first-class Vitest integration) | Unit-test the API client + parsers against recorded fixtures. |

### 1b. UI base: reuse the FMKW design system (decided 2026-08-08)

The extension reuses the design system from `../FMKW/apps/web` (React 19 + Tailwind v4 + shadcn/ui), **vendored by copy** (standalone repo, free to diverge):

- **Copy verbatim**: `src/styles/palette.css`, the semantic-token block from `src/styles.css` (oklch, dark-only, `--radius: 0`), self-hosted fonts (`@fontsource-variable/geist`, `geist-mono`, `oxanium`, `space-grotesk`).
- **Regenerate, not copy**: the `components/ui/*` React files. shadcn-svelte's CLI generates the Svelte 5 equivalents (button, card, table, sheet, tooltip, skeleton, spinner, badge, …), which read the **same CSS variables** as shadcn/ui — FMKW's theme applies automatically.
- **Rebuild in Svelte, reusing their Tailwind classes**: the small domain components we need — `stat-card`, `order-table`, `order-status`, `query-state`, `page-header`.
- **Shadow-DOM adaptation**: in content-script UIs, define tokens on `:host` instead of `:root` and put the `dark` class on the shadow container (FMKW's `@custom-variant dark` pattern carries over).

Result: the extension looks native to the FMKW product family with near-zero design work, while keeping Svelte-sized bundles.

### Why not WASM from the Rust crate?
The valuable parts of `axiomtrade-rs` are **knowledge** (endpoints, auth flow, payload shapes, WS cluster map), not compute. Its runtime deps (tokio, reqwest, tungstenite, IMAP OTP fetching) don't compile to browser WASM meaningfully — the browser already provides fetch/WebSocket/cookies. A thin TS port is smaller, debuggable, and HMR-friendly.

---

## 2. What we port from axiomtrade-rs (source → target)

| Rust source | What we take | TS target |
|---|---|---|
| `src/auth/client.rs` | Cookie names `auth-access-token`, `auth-refresh-token`; refresh flow `POST {api}/refresh-access-token` with refresh-token cookie; API endpoint pool `api2,3,6,7,8,9,10.axiom.trade`; required headers (Origin/Referer axiom.trade) | `src/lib/api/auth.ts` (token discovery + refresh) |
| `src/api/portfolio.rs` | `POST /portfolio-v5`, `POST https://axiom.trade/api/batched-sol-balance` | `src/lib/api/portfolio.ts` |
| `src/api/market_data.rs` | `/meme-trending?timePeriod=`, `/token-analysis?tokenTicker=`, `/price/{}`, `/batch-prices`, `/price-feed/{}?period=`, `/chart/{}?timeframe=`, `/clipboard-pair-info?address=` | `src/lib/api/market.ts` |
| `src/websocket/client.rs` | Cluster map (`cluster2..9`, `socket8`, regional `cluster-usw2` etc.), subscription message formats, ping/keepalive cadence, reconnect-on-expire logic | `src/lib/ws/client.ts` (v1: only if needed for enrichment; full feed is post-v1) |
| `src/models/{portfolio_v5,market}.rs` | Struct shapes → Zod schemas: `Position`, `BalanceStats`, `PerformanceMetrics`, `TrendingToken`, `TokenInfo`, `TokenAnalysis`, `PriceData`, ... | `src/lib/models/*.ts` |
| `src/utils/rate_limiter.rs`, `retry.rs` | Retry w/ exponential backoff, simple client-side rate limiting | `src/lib/utils/net.ts` |

**Not ported:** email/OTP login automation (`email/`, `password.rs`, `p256_crypto.rs` login path), Turnkey session creation, user-agent rotation, env loaders, Hyperliquid. The extension rides the session the user already has in the browser — no credentials ever handled by the extension.

---

## 3. Architecture

```
┌─────────────────────────── axiom.trade tab ───────────────────────────┐
│  page (MAIN world)                    content script (ISOLATED world) │
│  ┌──────────────────┐                 ┌────────────────────────────┐  │
│  │ interceptor.ts    │ postMessage →  │ Svelte UI in shadow roots: │  │
│  │ patches fetch/WS  │                │ • portfolio side-panel     │  │
│  │ observes payloads │                │ • token-page enrichment    │  │
│  └──────────────────┘                 │                            │  │
│                                       └─────────────┬──────────────┘  │
└─────────────────────────────────────────────────────┼─────────────────┘
                                            wxt messaging (typed)
                                                      │
                                     ┌────────────────▼───────────────┐
                                     │ background service worker      │
                                     │ • ApiClient (fetch w/ cookies) │
                                     │ • token refresh, retry, cache  │
                                     │ • rate limiter                 │
                                     └────────────────┬───────────────┘
                                                      │
                                     api*.axiom.trade / axiom.trade/api
```

### Hybrid data access (decided)
1. **Direct API calls** from the background service worker to `api*.axiom.trade`, sending the site's own `auth-access-token`/`auth-refresh-token` cookies (via `host_permissions` + `credentials: 'include'`; `cookies` permission as fallback for explicit header construction, matching how `auth/client.rs` builds `Cookie:` headers). Token expired → replay the SDK's refresh flow.
2. **Passive interception** in the page's MAIN world: patch `window.fetch`/`WebSocket` to observe responses the site already receives (portfolio pushes, price ticks) and forward them to the content script. Free real-time data, zero extra load, and doubles as a **live schema-drift detector** — if intercepted payloads disagree with our Zod schemas, we log exactly what changed since the Rust SDK was written.

### Manifest (MV3)
- `host_permissions`: `https://axiom.trade/*`, `https://*.axiom.trade/*`
- `permissions`: `storage`, `cookies`, `alarms` (periodic portfolio refresh)
- Content script matches: `https://axiom.trade/*`
- No remote code, no broad `<all_urls>` — keeps store review simple.

### WXT entrypoints
```
entrypoints/
  background.ts              # ApiClient owner, message router
  axiom.content/             # content script + Svelte shadow-root UIs
    index.ts
    PortfolioPanel.svelte
    TokenEnrichment.svelte
  interceptor.content.ts     # MAIN-world fetch/WS observer (registerContentScript world:'MAIN')
  popup/                     # small popup: status, settings, on/off toggles
```

---

## 4. V1 features (decided)

### F1 — Portfolio overlay
Collapsible side panel on any axiom.trade page: SOL balance, total USD value, open positions with live P&L, day performance. Data: `portfolio-v5` + `batched-sol-balance` on a 30s alarm + intercepted portfolio pushes in between. Wallet addresses auto-discovered from intercepted traffic (no manual config).

### F2 — Token page enrichment
Inject a stats strip on token pages: `token-analysis` (creator/dev info, related tokens), `clipboard-pair-info`, trending rank from `meme-trending`, price momentum from `price-feed`. Detect current token from URL + intercepted page data.

### Popup
Extension health (session detected? API reachable?) and feature toggles.

**Post-v1 backlog:** live new-token/price WebSocket feed with alerts, watchlist sync, tracked-wallet transactions overlay (`tracked-wallets-v2`), notifications.

---

## 5. Implementation phases

| Phase | Deliverable | Verify by |
|---|---|---|
| **0. Scaffold** | WXT + Svelte + TS project; Tailwind v4 + shadcn-svelte init; vendor FMKW tokens/fonts; loads in Chrome with a themed hello-world shadow-root panel on axiom.trade | `pnpm dev` opens Chrome, panel visible in FMKW dark theme |
| **1. Auth & API core** | `ApiClient`: cookie session discovery, refresh flow, endpoint pool + retry/rate-limit; Zod models for portfolio/market | Vitest against recorded fixtures; manual: background fetches portfolio while logged in |
| **2. Interceptor** | MAIN-world fetch/WS observer + typed message bridge; schema-drift logger | See live payloads in devtools; drift report empty or explained |
| **3. F1 Portfolio overlay** | Shadow-root side panel with live data | Panel matches values shown by axiom.trade itself |
| **4. F2 Token enrichment** | Stats strip on token pages | Correct data for 3+ different tokens |
| **5. Polish** | Options in popup, error toasts, dark-theme match with axiom UI, README | Full manual pass; `wxt zip` builds store-ready artifact |

Phases 1–2 are ordered so that by the time we build UI, we know the **real 2026 payload shapes** (SDK is from ~2025 and may have drifted).

---

## 6. Risks & mitigations

1. **API drift since the Rust SDK was written** — endpoints/payloads may have changed. Mitigation: Phase 2 interceptor validates real traffic against schemas before features depend on them; fixtures recorded from your own session.
2. **MV3 service worker lifetime** — background worker sleeps; WS connections die. Mitigation: v1 needs no persistent WS (alarms + interception); if post-v1 feed lands, use offscreen document or keepalive pattern.
3. **Site DOM changes break injection points** — axiom.trade ships often. Mitigation: anchor via stable selectors + graceful degradation (features hide rather than crash); interception doesn't depend on DOM at all.
4. **Session security** — extension reads data from your logged-in session. Mitigation: strictly read-only (no code path places trades), no credential storage, no external servers, all data stays local. Personal-use tool; not for the Chrome Web Store initially (side-load via `wxt dev`/unpacked).
5. **ToS** — automating requests against your own account may conflict with Axiom ToS; same exposure as running the Rust SDK's read APIs. Accepted by user; keep request volume low (rate limiter).

---

## 7. Repo layout (target)

```
axiom-companion/
  PLAN.md
  README.md
  package.json
  wxt.config.ts
  entrypoints/           # see §3
  src/
    lib/
      components/ui/     # shadcn-svelte generated components (FMKW-themed)
      components/        # stat-card, order-table, query-state... (Svelte ports)
      styles/            # palette.css + semantic tokens vendored from FMKW
      api/               # auth.ts, portfolio.ts, market.ts
      models/            # zod schemas ported from Rust models
      ws/                # (post-v1) cluster map + client
      utils/             # retry, rate-limit, logging
      bridge/            # typed messages content⇄background⇄MAIN-world
  tests/
    fixtures/            # recorded API payloads
```
