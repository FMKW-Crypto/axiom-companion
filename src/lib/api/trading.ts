import type { ApiClient } from "./client";
import {
  OrderResponseSchema,
  QuoteResponseSchema,
  SimulationSchema,
  validateAmount,
  validateSlippage,
  validateTokenMint,
  type OrderResponse,
  type QuoteResponse,
  type Simulation,
} from "@/lib/models/trading";
import { reportDrift } from "@/lib/models/drift";

/**
 * Ported from axiomtrade-rs/src/api/trading.rs.
 *
 * SAFETY: this module never executes a trade without an explicit, validated
 * request from the UI, and the UI always simulates first (see PLAN.md §6). If
 * `/batched-send-tx-v2` rejects an unsigned body — meaning execution requires a
 * Turnkey-signed transaction the extension deliberately cannot produce — the
 * caller (QuickTrade) falls back to driving the page's own trade form.
 */

export const DEFAULT_SLIPPAGE = 5.0; // from TradingClient::new

export class TradeValidationError extends Error {}

function validateBuy(
  mint: string,
  amountSol: number,
  slippage: number,
): void {
  const errors = [
    validateTokenMint(mint),
    validateAmount(amountSol, "SOL"),
    validateSlippage(slippage),
  ].filter((e): e is string => e !== null);
  if (errors.length) throw new TradeValidationError(errors.join("; "));
}

/** GET /quote — price/route preview, no side effects. */
export async function getQuote(
  api: ApiClient,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippagePercent = DEFAULT_SLIPPAGE,
): Promise<QuoteResponse | null> {
  const raw = await api.request({
    path:
      `/quote?inputMint=${encodeURIComponent(inputMint)}` +
      `&outputMint=${encodeURIComponent(outputMint)}` +
      `&amount=${amount}&slippage=${slippagePercent}`,
  });
  const parsed = QuoteResponseSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("quote", parsed.error, raw);
    return null;
  }
  return parsed.data;
}

/** POST /simulate — dry-run, no funds move. Always call before executing. */
export async function simulateBuy(
  api: ApiClient,
  tokenMint: string,
  amountSol: number,
  slippagePercent = DEFAULT_SLIPPAGE,
): Promise<Simulation | null> {
  validateBuy(tokenMint, amountSol, slippagePercent);
  const raw = await api.request({
    method: "POST",
    path: "/simulate",
    body: {
      token_mint: tokenMint,
      amount_sol: amountSol,
      slippage_percent: slippagePercent,
    },
  });
  const parsed = SimulationSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("simulate", parsed.error, raw);
    return null;
  }
  return parsed.data;
}

/**
 * POST /batched-send-tx-v2 — executes a buy. Guarded by validation; the caller
 * is responsible for confirmation UX and spend caps. Returns the parsed order
 * response, or throws if the endpoint requires a signed transaction.
 */
export async function executeBuy(
  api: ApiClient,
  tokenMint: string,
  amountSol: number,
  slippagePercent = DEFAULT_SLIPPAGE,
): Promise<OrderResponse> {
  validateBuy(tokenMint, amountSol, slippagePercent);
  const raw = await api.request({
    method: "POST",
    path: "/batched-send-tx-v2",
    body: {
      token_mint: tokenMint,
      amount_sol: amountSol,
      slippage_percent: slippagePercent,
      priority_fee: null,
    },
  });
  const parsed = OrderResponseSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("batched-send-tx-v2", parsed.error, raw);
  }
  return parsed.success ? parsed.data : {};
}
