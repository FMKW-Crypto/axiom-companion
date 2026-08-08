import type { PortfolioV5Response } from "@/lib/models/portfolio";
import type { TokenAnalysis } from "@/lib/models/market";
import type { OrderResponse, Simulation } from "@/lib/models/trading";

/**
 * Typed request/response contract between the content script and the background
 * service worker. One discriminated union keeps both ends honest without a
 * messaging dependency. `browser.runtime.sendMessage` is promise-based in MV3.
 */

export type Req =
  | { type: "getPortfolio"; wallets: string[] }
  | { type: "getBalances"; wallets: string[] }
  | { type: "getTokenAnalysis"; ticker: string }
  | { type: "getTokenInfo"; address: string }
  | { type: "getPrice"; mint: string }
  | { type: "reportWallets"; wallets: string[] }
  | { type: "getKnownWallets" }
  | { type: "simulateBuy"; mint: string; amountSol: number; slippage: number }
  | { type: "executeBuy"; mint: string; amountSol: number; slippage: number };

export type Res = {
  getPortfolio: PortfolioV5Response;
  getBalances: Record<string, unknown>;
  getTokenAnalysis: TokenAnalysis | null;
  getTokenInfo: unknown;
  getPrice: unknown;
  reportWallets: { ok: true };
  getKnownWallets: string[];
  simulateBuy: Simulation | null;
  executeBuy: OrderResponse;
};

export type ResultOf<T extends Req["type"]> = Res[T];

/** Envelope so failures cross the message boundary as values, not rejections. */
export type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function sendMessage<T extends Req>(
  req: T,
): Promise<ResultOf<T["type"]>> {
  const reply = (await browser.runtime.sendMessage(req)) as Envelope<
    ResultOf<T["type"]>
  >;
  if (!reply) throw new Error("No response from background worker");
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
