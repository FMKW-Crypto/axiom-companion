import { z } from "zod";

/**
 * Ported from axiomtrade-rs/src/models/portfolio_v5.rs and portfolio.rs.
 *
 * Every field is optional / nullish and objects `.passthrough()`, deliberately:
 * these describe a live third-party API that has drifted since the Rust SDK was
 * written (~2025). A strict schema would throw on the first unexpected null and
 * blank the whole panel; a lenient one degrades to "unknown" per field. The
 * interceptor (entrypoints/interceptor) reports fields that drift so the schema
 * can be tightened deliberately rather than by guesswork.
 */

const num = z.number().nullish();
const str = z.string().nullish();

export const PositionSchema = z
  .object({
    tokenAddress: str,
    symbol: str,
    name: str,
    amount: num,
    valueSol: num,
    valueUsd: num,
    pnl: num,
    pnlPercent: num,
  })
  .passthrough();
export type Position = z.infer<typeof PositionSchema>;

export const TransactionSchema = z
  .object({
    signature: str,
    timestamp: num,
    tokenAddress: str,
    symbol: str,
    transactionType: str,
    amount: num,
    price: num,
    valueSol: num,
    valueUsd: num,
  })
  .passthrough();
export type Transaction = z.infer<typeof TransactionSchema>;

export const BalanceStatsSchema = z
  .object({
    totalValueSol: num,
    availableBalanceSol: num,
    unrealizedPnlSol: num,
  })
  .passthrough();
export type BalanceStats = z.infer<typeof BalanceStatsSchema>;

export const PnlBreakdownSchema = z
  .object({
    over500Percent: num,
    between200And500Percent: num,
    between0And200Percent: num,
    between0AndNeg50Percent: num,
    underNeg50Percent: num,
  })
  .passthrough();

export const PeriodMetricsSchema = z
  .object({
    totalPnl: num,
    buyCount: num,
    sellCount: num,
    pnlBreakdown: PnlBreakdownSchema.nullish(),
    usdBought: num,
    usdSold: num,
    solBought: num,
    solSold: num,
    realizedSolPnl: num,
    realizedUsdPnl: num,
  })
  .passthrough();
export type PeriodMetrics = z.infer<typeof PeriodMetricsSchema>;

export const PerformanceMetricsSchema = z
  .object({
    oneDay: PeriodMetricsSchema.nullish(),
    sevenDay: PeriodMetricsSchema.nullish(),
    thirtyDay: PeriodMetricsSchema.nullish(),
    allTime: PeriodMetricsSchema.nullish(),
  })
  .passthrough();
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

export const PortfolioV5ResponseSchema = z
  .object({
    activePositions: z.array(PositionSchema).nullish(),
    historyPositions: z.array(PositionSchema).nullish(),
    topPositions: z.array(PositionSchema).nullish(),
    transactions: z.array(TransactionSchema).nullish(),
    balanceStats: BalanceStatsSchema.nullish(),
    performanceMetrics: PerformanceMetricsSchema.nullish(),
  })
  .passthrough();
export type PortfolioV5Response = z.infer<typeof PortfolioV5ResponseSchema>;

/**
 * /batched-sol-balance response. The Rust SDK parses a flexible map keyed by
 * wallet address; the exact leaf shape varies, so we keep the map generic and
 * pull `balanceSol` / `totalValueUsd` opportunistically at the call site.
 */
export const BatchBalanceResponseSchema = z.record(z.unknown());
export type BatchBalanceResponse = z.infer<typeof BatchBalanceResponseSchema>;
