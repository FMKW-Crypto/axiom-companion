import { ApiClient } from "@/lib/api/client";
import { getPortfolioSummary, getBatchedSolBalance } from "@/lib/api/portfolio";
import {
  getTokenAnalysis,
  getTokenInfoByAddress,
  getTokenPrice,
} from "@/lib/api/market";
import { simulateBuy, executeBuy } from "@/lib/api/trading";
import { addWallets, getWallets } from "@/lib/wallets";
import type { Req, Envelope } from "@/lib/bridge/messages";

/**
 * Background service worker: owns the single ApiClient, routes typed messages
 * from content scripts, and keeps portfolio data warm on an alarm. All Axiom
 * network access funnels through here so cookies attach and CORS never bites.
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

  // Periodic portfolio warm-up so the panel opens instantly (F1). 30s cadence
  // matches the PLAN; interception fills the gaps between ticks.
  browser.alarms.create("portfolio-refresh", { periodInMinutes: 0.5 });
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "portfolio-refresh") return;
    const wallets = await getWallets();
    if (wallets.length === 0) return;
    try {
      await getPortfolioSummary(api, wallets);
    } catch {
      // Logged out or offline; the next tick retries.
    }
  });
});

async function handle(api: ApiClient, req: Req): Promise<unknown> {
  switch (req.type) {
    case "getPortfolio":
      return getPortfolioSummary(api, req.wallets);
    case "getBalances":
      return getBatchedSolBalance(api, req.wallets);
    case "getTokenAnalysis":
      return getTokenAnalysis(api, req.ticker);
    case "getTokenInfo":
      return getTokenInfoByAddress(api, req.address);
    case "getPrice":
      return getTokenPrice(api, req.mint);
    case "reportWallets":
      await addWallets(req.wallets);
      return { ok: true };
    case "getKnownWallets":
      return getWallets();
    case "simulateBuy":
      return simulateBuy(api, req.mint, req.amountSol, req.slippage);
    case "executeBuy":
      return executeBuy(api, req.mint, req.amountSol, req.slippage);
  }
}
