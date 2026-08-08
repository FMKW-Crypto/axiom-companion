import { ApiClient } from "@/lib/api/client";
import {
  getTokenAnalysis,
  getTokenInfoByAddress,
  getTokenPrice,
} from "@/lib/api/market";
import type { Req, Envelope } from "@/lib/bridge/messages";

/**
 * Background service worker: owns the single ApiClient and routes typed
 * messages from the content script. All Axiom network access funnels through
 * here so cookies attach and CORS never bites.
 */
export default defineBackground(() => {
  const api = new ApiClient();

  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    handle(api, raw as Req)
      .then((data) => sendResponse({ ok: true, data } satisfies Envelope<unknown>))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        } satisfies Envelope<never>),
      );
    return true; // async response
  });
});

async function handle(api: ApiClient, req: Req): Promise<unknown> {
  switch (req.type) {
    case "getTokenAnalysis":
      return getTokenAnalysis(api, req.ticker);
    case "getTokenInfo":
      return getTokenInfoByAddress(api, req.address);
    case "getPrice":
      return getTokenPrice(api, req.mint);
  }
}
