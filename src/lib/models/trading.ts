import { z } from "zod";

/**
 * Ported from axiomtrade-rs/src/models/trading.rs.
 *
 * Request bodies mirror the Rust structs field-for-field. Note the SDK's own
 * TODOs: the real `/batched-send-tx-v2` endpoint may expect a signed
 * transaction rather than raw amounts (see PLAN.md §6 risk 2). These types
 * describe the SDK's *intended* contract; the trading client verifies against a
 * `/simulate` dry-run before ever executing, and falls back to driving the
 * page's own trade form if the API rejects unsigned bodies.
 */

export interface BuyOrderRequest {
  token_mint: string;
  amount_sol: number;
  slippage_percent: number;
  priority_fee?: number | null;
}

export interface SellOrderRequest {
  token_mint: string;
  amount_tokens: number;
  slippage_percent: number;
  priority_fee?: number | null;
}

export const OrderStatus = z.enum(["success", "failed", "pending", "cancelled"]);
export const OrderType = z.enum(["buy", "sell", "swap"]);

export const OrderResponseSchema = z
  .object({
    signature: z.string().nullish(),
    status: OrderStatus.nullish(),
    transactionType: OrderType.nullish(),
    tokenMint: z.string().nullish(),
    amountIn: z.number().nullish(),
    amountOut: z.number().nullish(),
    pricePerToken: z.number().nullish(),
    totalSol: z.number().nullish(),
    fee: z.number().nullish(),
    timestamp: z.number().nullish(),
  })
  .passthrough();
export type OrderResponse = z.infer<typeof OrderResponseSchema>;

export const QuoteResponseSchema = z
  .object({
    inputMint: z.string().nullish(),
    outputMint: z.string().nullish(),
    inAmount: z.number().nullish(),
    outAmount: z.number().nullish(),
    priceImpact: z.number().nullish(),
    fee: z.number().nullish(),
  })
  .passthrough();
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

export const SimulationSchema = z
  .object({
    success: z.boolean().nullish(),
    error: z.string().nullish(),
    logs: z.array(z.string()).nullish(),
    unitsConsumed: z.number().nullish(),
  })
  .passthrough();
export type Simulation = z.infer<typeof SimulationSchema>;

/**
 * Trade input validation, ported from TradingClient::validate_* in
 * axiomtrade-rs/src/api/trading.rs. Pure — no I/O — so it is unit-tested
 * directly and reused by both the API path and the page-driving fallback.
 */
export function validateTokenMint(mint: string): string | null {
  if (mint.length < 32 || mint.length > 44) {
    return `Invalid token mint length: ${mint.length} (expected 32-44)`;
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(mint)) {
    return "Token mint is not valid base58";
  }
  return null;
}

export function validateAmount(amount: number, unit: string): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return `${unit} amount must be greater than zero`;
  }
  return null;
}

export function validateSlippage(percent: number): string | null {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return "Slippage must be between 0 and 100 percent";
  }
  return null;
}
