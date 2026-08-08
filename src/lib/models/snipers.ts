import { z } from "zod";

/**
 * Early buyers of a token, from `GET /sniper-transactions-v3?pairAddress=`.
 *
 * Not in the Rust SDK — discovered from the live site (it backs axiom's own
 * "Snipers" modal). The response groups transactions into `instant` (bought in
 * the token's first block) and `early` (bought shortly after), as positional
 * 13-field arrays:
 *
 *   [isoTime, ?, ?, wallet, pairAddress, priceSol, priceUsd, tokenAmount,
 *    signature, solAmount, usdAmount, side, fee]
 *
 * Rows are decoded defensively by index — a malformed row is dropped, never
 * thrown on — and aggregated per wallet into an `EarlyBuyer` summary.
 */

export const SniperTransactionsSchema = z
  .object({
    instant: z.array(z.array(z.unknown())).nullish(),
    early: z.array(z.array(z.unknown())).nullish(),
  })
  .passthrough();
export type SniperTransactions = z.infer<typeof SniperTransactionsSchema>;

export interface EarlyBuyer {
  wallet: string;
  /** "instant" = sniped the launch block; "early" = bought just after. */
  group: "instant" | "early";
  buys: number;
  sells: number;
  tokensBought: number;
  tokensSold: number;
  solSpent: number;
  solReceived: number;
  firstBuyTime: string | null;
  status: "holding" | "partial" | "sold";
}

interface Tx {
  time: string | null;
  wallet: string;
  tokenAmount: number;
  solAmount: number;
  side: "buy" | "sell";
}

function decodeRow(row: unknown[]): Tx | null {
  const wallet = row[3];
  const side = row[11];
  if (typeof wallet !== "string" || (side !== "buy" && side !== "sell")) {
    return null;
  }
  return {
    time: typeof row[0] === "string" ? row[0] : null,
    wallet,
    tokenAmount: typeof row[7] === "number" ? row[7] : 0,
    solAmount: typeof row[9] === "number" ? row[9] : 0,
    side,
  };
}

/** Fraction of the bought amount below which a position counts as dust. */
const DUST = 0.005;

export function aggregateEarlyBuyers(data: SniperTransactions): EarlyBuyer[] {
  const byWallet = new Map<string, EarlyBuyer>();

  for (const group of ["instant", "early"] as const) {
    for (const row of data[group] ?? []) {
      const tx = decodeRow(row);
      if (!tx) continue;
      let b = byWallet.get(tx.wallet);
      if (!b) {
        b = {
          wallet: tx.wallet,
          group,
          buys: 0,
          sells: 0,
          tokensBought: 0,
          tokensSold: 0,
          solSpent: 0,
          solReceived: 0,
          firstBuyTime: null,
          status: "holding",
        };
        byWallet.set(tx.wallet, b);
      }
      // A wallet in both feeds is an instant sniper first and foremost.
      if (group === "instant") b.group = "instant";
      if (tx.side === "buy") {
        b.buys += 1;
        b.tokensBought += tx.tokenAmount;
        b.solSpent += tx.solAmount;
        if (tx.time && (b.firstBuyTime === null || tx.time < b.firstBuyTime)) {
          b.firstBuyTime = tx.time;
        }
      } else {
        b.sells += 1;
        b.tokensSold += tx.tokenAmount;
        b.solReceived += tx.solAmount;
      }
    }
  }

  const buyers = [...byWallet.values()];
  for (const b of buyers) {
    const remaining = b.tokensBought - b.tokensSold;
    if (b.tokensBought === 0 || remaining <= b.tokensBought * DUST) {
      b.status = "sold";
    } else if (b.tokensSold <= b.tokensBought * DUST) {
      b.status = "holding";
    } else {
      b.status = "partial";
    }
  }

  // Earliest buyers first; wallets with no recorded buy sink to the end.
  return buyers.sort((a, z2) => {
    if (a.firstBuyTime === null) return 1;
    if (z2.firstBuyTime === null) return -1;
    return a.firstBuyTime < z2.firstBuyTime ? -1 : 1;
  });
}
