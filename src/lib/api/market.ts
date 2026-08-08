import type { ApiClient } from "./client";
import {
  TokenAnalysisSchema,
  TokenInfoSchema,
  PriceDataSchema,
  type TokenAnalysis,
  type TokenInfo,
  type PriceData,
} from "@/lib/models/market";
import {
  SniperTransactionsSchema,
  aggregateEarlyBuyers,
  type EarlyBuyer,
} from "@/lib/models/snipers";
import { reportDrift } from "@/lib/models/drift";

/**
 * Ported from axiomtrade-rs/src/api/market_data.rs. Endpoint shapes and query
 * params (`tokenTicker`, `address`, `period`) are taken from the Rust `format!`
 * URLs.
 */

/** GET /token-analysis?tokenTicker={symbol} — creator risk, related tokens. */
export async function getTokenAnalysis(
  api: ApiClient,
  tokenTicker: string,
): Promise<TokenAnalysis | null> {
  const raw = await api.request({
    path: `/token-analysis?tokenTicker=${encodeURIComponent(tokenTicker)}`,
  });
  const parsed = TokenAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("token-analysis", parsed.error, raw);
    return null;
  }
  return parsed.data;
}

/** GET /clipboard-pair-info?address={address} — token metadata by mint/pair. */
export async function getTokenInfoByAddress(
  api: ApiClient,
  address: string,
): Promise<TokenInfo | null> {
  const raw = await api.request({
    path: `/clipboard-pair-info?address=${encodeURIComponent(address)}`,
  });
  const parsed = TokenInfoSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("clipboard-pair-info", parsed.error, raw);
    return null;
  }
  return parsed.data;
}

/**
 * GET /sniper-transactions-v3?pairAddress={pair} — the token's earliest
 * buyers (instant + early snipers), aggregated per wallet. Not from the Rust
 * SDK; discovered from the live site's own Snipers modal.
 */
export async function getEarlyBuyers(
  api: ApiClient,
  pairAddress: string,
): Promise<EarlyBuyer[] | null> {
  const raw = await api.request({
    path: `/sniper-transactions-v3?pairAddress=${encodeURIComponent(pairAddress)}`,
  });
  const parsed = SniperTransactionsSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("sniper-transactions-v3", parsed.error, raw);
    return null;
  }
  return aggregateEarlyBuyers(parsed.data);
}

/** GET /price/{mint} — current price. */
export async function getTokenPrice(
  api: ApiClient,
  mint: string,
): Promise<PriceData | null> {
  const raw = await api.request({
    path: `/price/${encodeURIComponent(mint)}`,
  });
  const parsed = PriceDataSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("price", parsed.error, raw);
    return null;
  }
  return parsed.data;
}
