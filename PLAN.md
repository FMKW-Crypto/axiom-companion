# Axiom Companion — Browser Extension Plan

A browser extension that integrates directly into **axiom.trade**, enriching token pages with creator-risk and metadata stats — strictly read-only. API logic is ported from the Rust SDK at `../axiomtrade-rs` (TypeScript rewrite, not FFI/WASM — see "Why not WASM" below).

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
| `src/auth/client.rs` | Cookie names `auth-access-token`, `auth-refresh-token`; refresh flow `POST {api}/refresh-access-token` with refresh-token cookie; API endpoint pool `api2,3,6,7,8,9,10.axiom.trade`; required headers (Origin/Referer axiom.trade) | `src/lib/api/client.ts` (session riding + refresh) |
| `src/api/market_data.rs` | `/meme-trending?timePeriod=`, `/token-analysis?tokenTicker=`, `/price/{}`, `/batch-prices`, `/price-feed/{}?period=`, `/chart/{}?timeframe=`, `/clipboard-pair-info?address=` | `src/lib/api/market.ts` |
| `src/models/market.rs` | Struct shapes → Zod schemas: `TrendingToken`, `TokenInfo`, `TokenAnalysis`, `PriceData`, ... | `src/lib/models/market.ts` |
| `src/utils/rate_limiter.rs`, `retry.rs` | Retry w/ exponential backoff, simple client-side rate limiting | `src/lib/utils/net.ts` |

**Not ported:** trading and portfolio endpoints, WebSocket feed, email/OTP login automation (`email/`, `password.rs`, `p256_crypto.rs` login path), Turnkey session creation, user-agent rotation, env loaders, Hyperliquid. The extension rides the session the user already has in the browser — no credentials ever handled by the extension.

---

## 3. Architecture

```
┌──────────────── axiom.trade tab ────────────────┐
│  content script (ISOLATED world)                │
│  ┌───────────────────────────────────────────┐  │
│  │ Svelte UI in a shadow root:               │  │
│  │ • token-page enrichment panel             │  │
│  │   (token detected from the page URL)      │  │
│  └─────────────────────┬─────────────────────┘  │
└────────────────────────┼────────────────────────┘
               wxt messaging (typed)
                         │
        ┌────────────────▼───────────────┐
        │ background service worker      │
        │ • ApiClient (fetch w/ cookies) │
        │ • token refresh, retry         │
        │ • rate limiter                 │
        └────────────────┬───────────────┘
                         │
                 api*.axiom.trade
```

### Data access (decided)
**Direct API calls** from the background service worker to `api*.axiom.trade`, sending the site's own `auth-access-token`/`auth-refresh-token` cookies (via `host_permissions` + `credentials: 'include'`). Token expired → replay the SDK's refresh flow. Responses are parsed with lenient Zod schemas that log **schema drift** — exactly which fields changed since the Rust SDK was written — instead of crashing.

### Manifest (MV3)
- `host_permissions`: `https://axiom.trade/*`, `https://*.axiom.trade/*`
- No extra `permissions` needed — the extension keeps no state and sets no alarms.
- Content script matches: `https://axiom.trade/*`
- No remote code, no broad `<all_urls>` — keeps store review simple.

### WXT entrypoints
```
entrypoints/
  background.ts              # ApiClient owner, message router
  axiom.content/             # content script + Svelte shadow-root UI
    index.ts
    TokenEnrichment.svelte
  popup/                     # small popup: what the extension does
```

---

## 4. V1 features (decided)

### F1 — Token page enrichment
Inject a stats strip on token pages: `token-analysis` (creator/dev info, related tokens), `clipboard-pair-info`, trending rank from `meme-trending`, price momentum from `price-feed`. Detect current token from the URL; the panel only exists on token pages.

### Popup
A short description of what the extension does; extension health (API reachable?) is post-v1.

**Post-v1 backlog:** trending rank + price momentum in the strip, API-health popup check.

---

## 5. Implementation phases

| Phase | Deliverable | Verify by |
|---|---|---|
| **0. Scaffold** | WXT + Svelte + TS project; Tailwind v4 + shadcn-svelte init; vendor FMKW tokens/fonts; loads in Chrome with a themed hello-world shadow-root panel on axiom.trade | `pnpm dev` opens Chrome, panel visible in FMKW dark theme |
| **1. Auth & API core** | `ApiClient`: session riding, refresh flow, endpoint pool + retry/rate-limit; Zod models for market data; schema-drift logger | Vitest against recorded fixtures; manual: background fetches token data while logged in |
| **2. F1 Token enrichment** | Stats strip on token pages | Correct data for 3+ different tokens |
| **3. Polish** | Popup, error states, dark-theme match with axiom UI, README | Full manual pass; `wxt zip` builds store-ready artifact |

The lenient schemas + drift logging exist because the SDK is from ~2025 and the **real 2026 payload shapes** may have drifted.

---

## 6. Risks & mitigations

1. **API drift since the Rust SDK was written** — endpoints/payloads may have changed. Mitigation: lenient Zod schemas degrade per-field instead of crashing, and the drift logger reports exactly which fields disagree.
2. **MV3 service worker lifetime** — background worker sleeps. Mitigation: the extension is stateless and request/response only; nothing depends on the worker staying alive.
3. **Site DOM changes break injection points** — axiom.trade ships often. Mitigation: the panel anchors to `<body>` and detects tokens from the URL, not the DOM; it hides rather than crashes.
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
      api/               # client.ts, market.ts
      models/            # zod schemas ported from Rust models
      utils/             # retry, rate-limit, logging
      bridge/            # typed messages content⇄background
  tests/
    fixtures/            # recorded API payloads
```
