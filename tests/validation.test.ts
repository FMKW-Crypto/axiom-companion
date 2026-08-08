import { describe, it, expect } from "vitest";
import { currentTokenAddress } from "@/lib/tokenPage";
import { usd, sol, pct, shortAddr } from "@/lib/format";
import { PortfolioV5ResponseSchema } from "@/lib/models/portfolio";
import { TokenAnalysisSchema } from "@/lib/models/market";

// A real Solana mint (USDC) — 44 base58 chars.
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

describe("token page detection", () => {
  it("finds a base58 address in the path", () => {
    expect(currentTokenAddress(`/meme/${USDC}`)).toBe(USDC);
  });
  it("returns null off token pages", () => {
    expect(currentTokenAddress("/portfolio")).toBeNull();
    expect(currentTokenAddress("/")).toBeNull();
  });
});

describe("formatters", () => {
  it("formats usd/sol/pct with an em dash for nullish", () => {
    expect(usd(null)).toBe("—");
    expect(sol(undefined)).toBe("—");
    expect(pct(null)).toBe("—");
    expect(pct(12.34)).toBe("+12.3%");
    expect(pct(-5)).toBe("-5.0%");
  });
  it("shortens long addresses", () => {
    expect(shortAddr(USDC)).toBe("EPjF…Dt1v");
    expect(shortAddr("short")).toBe("short");
  });
});

describe("lenient schemas tolerate drift", () => {
  it("parses an empty portfolio object", () => {
    expect(PortfolioV5ResponseSchema.safeParse({}).success).toBe(true);
  });
  it("parses portfolio with unexpected extra fields", () => {
    const r = PortfolioV5ResponseSchema.safeParse({
      activePositions: [{ symbol: "FOO", valueUsd: 10, surprise: true }],
      newFieldFromApi: 123,
    });
    expect(r.success).toBe(true);
  });
  it("keeps nulls as nullish without throwing", () => {
    const r = TokenAnalysisSchema.safeParse({
      creatorRiskLevel: null,
      creatorRugCount: null,
      topOgCoins: null,
    });
    expect(r.success).toBe(true);
  });
});
