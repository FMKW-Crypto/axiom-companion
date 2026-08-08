import { describe, it, expect } from "vitest";
import { currentTokenAddress } from "@/lib/tokenPage";
import { shortAddr } from "@/lib/format";
import { TokenAnalysisSchema, TokenInfoSchema } from "@/lib/models/market";

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
  it("shortens long addresses", () => {
    expect(shortAddr(USDC)).toBe("EPjF…Dt1v");
    expect(shortAddr("short")).toBe("short");
    expect(shortAddr(null)).toBe("—");
  });
});

describe("lenient schemas tolerate drift", () => {
  it("parses an empty token info object", () => {
    expect(TokenInfoSchema.safeParse({}).success).toBe(true);
  });
  it("parses token info with unexpected extra fields", () => {
    const r = TokenInfoSchema.safeParse({
      tokenTicker: "FOO",
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
