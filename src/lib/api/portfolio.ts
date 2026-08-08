import type { ApiClient } from "./client";
import { MAIN_ORIGIN } from "./client";
import {
  PortfolioV5ResponseSchema,
  BatchBalanceResponseSchema,
  type PortfolioV5Response,
  type BatchBalanceResponse,
} from "@/lib/models/portfolio";
import { reportDrift } from "@/lib/models/drift";

/**
 * Ported from axiomtrade-rs/src/api/portfolio.rs.
 */

/**
 * POST /portfolio-v5. The Rust client discovered (from Axiom's own JS) that
 * `walletAddressRaw` must be the addresses sorted then comma-joined, and the
 * body carries `isOtherWallet`, `totalSolBalance`, `tokenAddressToAmountMap`
 * and a minute-granularity `timeOffset`. We reproduce that exactly.
 */
export async function getPortfolioSummary(
  api: ApiClient,
  walletAddresses: string[],
): Promise<PortfolioV5Response> {
  const walletAddressRaw = [...walletAddresses].sort().join(",");
  const timeOffset = -new Date().getTimezoneOffset(); // minutes, matches JS

  const raw = await api.request({
    method: "POST",
    path: "/portfolio-v5",
    body: {
      walletAddressRaw,
      isOtherWallet: false,
      totalSolBalance: 0,
      tokenAddressToAmountMap: {},
      timeOffset,
    },
  });

  const parsed = PortfolioV5ResponseSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("portfolio-v5", parsed.error, raw);
    // Lenient schema rarely fails; if it does, hand back an empty-but-valid shape.
    return {};
  }
  return parsed.data;
}

/**
 * POST https://axiom.trade/api/batched-sol-balance. The Rust SDK notes this
 * only exists on the main domain, not the api* pool — so we pass an absolute
 * `url` rather than a rotating `path`.
 */
export async function getBatchedSolBalance(
  api: ApiClient,
  walletAddresses: string[],
): Promise<BatchBalanceResponse> {
  const raw = await api.request({
    method: "POST",
    url: `${MAIN_ORIGIN}/api/batched-sol-balance`,
    body: { publicKeys: walletAddresses },
  });

  const parsed = BatchBalanceResponseSchema.safeParse(raw);
  if (!parsed.success) {
    reportDrift("batched-sol-balance", parsed.error, raw);
    return {};
  }
  return parsed.data;
}
