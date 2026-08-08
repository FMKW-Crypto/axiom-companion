import { describe, it, expect } from "vitest";
import {
  SniperTransactionsSchema,
  aggregateEarlyBuyers,
} from "@/lib/models/snipers";
import fixture from "./fixtures/sniper-transactions.json";

// The fixture is a trimmed real capture of GET /sniper-transactions-v3 for a
// live pump token (recorded 2026-08-08).

describe("sniper-transactions parsing", () => {
  it("parses the recorded payload", () => {
    expect(SniperTransactionsSchema.safeParse(fixture).success).toBe(true);
  });

  it("tolerates missing groups", () => {
    expect(SniperTransactionsSchema.safeParse({}).success).toBe(true);
    const parsed = SniperTransactionsSchema.parse({});
    expect(aggregateEarlyBuyers(parsed)).toEqual([]);
  });
});

describe("early-buyer aggregation", () => {
  const buyers = aggregateEarlyBuyers(SniperTransactionsSchema.parse(fixture));

  it("aggregates one entry per wallet", () => {
    expect(buyers).toHaveLength(8);
    const wallets = buyers.map((b) => b.wallet);
    expect(new Set(wallets).size).toBe(8);
  });

  it("keeps instant/early grouping", () => {
    expect(buyers.filter((b) => b.group === "instant")).toHaveLength(4);
    expect(buyers.filter((b) => b.group === "early")).toHaveLength(4);
  });

  it("sorts earliest buy first", () => {
    const times = buyers.map((b) => b.firstBuyTime);
    expect(times[0]).toBe("2026-08-08T12:31:22.729Z");
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! >= times[i - 1]!).toBe(true);
    }
  });

  it("classifies positions", () => {
    const byPrefix = (p: string) => buyers.find((b) => b.wallet.startsWith(p))!;
    // Never sold a token.
    expect(byPrefix("FDKd").status).toBe("holding");
    // Bought 24.7M, sold 18.0M.
    expect(byPrefix("HcUx").status).toBe("partial");
    expect(byPrefix("HcUx").sells).toBe(4);
  });

  it("drops malformed rows instead of throwing", () => {
    const dirty = SniperTransactionsSchema.parse({
      instant: [[], [null, null, null, 42], ["t", 0, 0, "Wallet111", "p", 0, 0, "x", "sig", 1, 1, "buy", 0]],
    });
    const out = aggregateEarlyBuyers(dirty);
    expect(out).toHaveLength(1);
    expect(out[0]!.wallet).toBe("Wallet111");
    // Non-numeric tokenAmount degrades to 0, not NaN.
    expect(out[0]!.tokensBought).toBe(0);
    expect(out[0]!.solSpent).toBe(1);
  });

  it("marks a seller with no recorded buys as sold", () => {
    const parsed = SniperTransactionsSchema.parse({
      early: [["t", 0, 0, "W2", "p", 0, 0, 5, "sig", 1, 1, "sell", 0]],
    });
    expect(aggregateEarlyBuyers(parsed)[0]!.status).toBe("sold");
  });
});
