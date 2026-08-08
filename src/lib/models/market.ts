import { z } from "zod";

/**
 * Ported from axiomtrade-rs/src/models/market.rs. The `#[serde(rename = ...)]`
 * attributes on the Rust side reveal the real wire names Axiom uses
 * (`tokenAddress`, `tokenTicker`, ...), which are what we key on here.
 */

const num = z.number().nullish();
const str = z.string().nullish();

export const TokenInfoSchema = z
  .object({
    tokenAddress: str,
    tokenTicker: str,
    tokenName: str,
    tokenDecimals: num,
    supply: num,
    liquiditySol: num,
    liquidityToken: num,
    pairAddress: str,
    protocol: str,
    createdAt: str,
    tokenImage: str,
    mintAuthority: str,
    freezeAuthority: str,
    lpBurned: num,
  })
  .passthrough();
export type TokenInfo = z.infer<typeof TokenInfoSchema>;

export const RelatedTokenSchema = z
  .object({
    tokenAddress: str,
    tokenTicker: str,
    tokenName: str,
    pairAddress: str,
    marketCap: num,
    createdAt: str,
    lastTradeTime: str,
    image: str,
    migrated: z.boolean().nullish(),
    bondingCurvePercent: num,
  })
  .passthrough();
export type RelatedToken = z.infer<typeof RelatedTokenSchema>;

export const TokenAnalysisSchema = z
  .object({
    creatorRiskLevel: str,
    creatorRugCount: num,
    creatorTokenCount: num,
    topMarketCapCoins: z.array(RelatedTokenSchema).nullish(),
    topOgCoins: z.array(RelatedTokenSchema).nullish(),
  })
  .passthrough();
export type TokenAnalysis = z.infer<typeof TokenAnalysisSchema>;

export const PriceDataSchema = z
  .object({
    priceUsd: num,
    priceSol: num,
    price: num,
    timestamp: num,
  })
  .passthrough();
export type PriceData = z.infer<typeof PriceDataSchema>;

export const TrendingTokenSchema = z
  .object({
    tokenAddress: str,
    tokenTicker: str,
    symbol: str,
    tokenName: str,
    priceUsd: num,
    marketCap: num,
    volume24h: num,
    rank: num,
  })
  .passthrough();
export type TrendingToken = z.infer<typeof TrendingTokenSchema>;
