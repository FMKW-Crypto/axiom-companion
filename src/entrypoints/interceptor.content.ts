/**
 * MAIN-world interceptor. Runs in the page's own JS context (not the isolated
 * content-script world) so it can monkey-patch `window.fetch` and `WebSocket`.
 * It never blocks or alters traffic — it only observes what axiom.trade already
 * sends/receives and relays two things to the isolated content script via
 * window.postMessage:
 *
 *   1. wallet addresses the page references (free auto-discovery, no config)
 *   2. nothing else yet — price/portfolio push forwarding is a post-v1 hook
 *      left stubbed here so the wiring exists.
 *
 * Passive by design: zero extra requests, and it doubles as a live check that
 * our understanding of Axiom's traffic still matches reality (PLAN §3).
 */
export default defineContentScript({
  matches: ["https://axiom.trade/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const BASE58 = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    const seen = new Set<string>();

    const emitWallets = (candidates: Iterable<string>) => {
      const fresh: string[] = [];
      for (const c of candidates) {
        if (!seen.has(c)) {
          seen.add(c);
          fresh.push(c);
        }
      }
      if (fresh.length) {
        window.postMessage(
          { source: "axiom-companion", kind: "wallets", wallets: fresh },
          window.location.origin,
        );
      }
    };

    const scan = (text: string | undefined | null) => {
      if (!text) return;
      const m = text.match(BASE58);
      if (m) emitWallets(m);
    };

    // Patch fetch: scan request URL + body for wallet-shaped strings.
    const origFetch = window.fetch;
    window.fetch = function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      try {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("portfolio") || url.includes("balance")) {
          scan(url);
          if (typeof init?.body === "string") scan(init.body);
        }
      } catch {
        // Never let observation break the page's own fetch.
      }
      return origFetch.apply(this, arguments as never);
    };

    // Patch WebSocket construction: the URL sometimes carries the wallet.
    const OrigWS = window.WebSocket;
    const PatchedWS = function (
      this: WebSocket,
      url: string | URL,
      protocols?: string | string[],
    ) {
      try {
        scan(typeof url === "string" ? url : url.toString());
      } catch {
        /* ignore */
      }
      return new OrigWS(url, protocols);
    } as unknown as typeof WebSocket;
    PatchedWS.prototype = OrigWS.prototype;
    (PatchedWS as { OPEN: number }).OPEN = OrigWS.OPEN;
    window.WebSocket = PatchedWS;
  },
});
