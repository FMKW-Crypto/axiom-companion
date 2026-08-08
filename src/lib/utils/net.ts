/**
 * Retry + rate-limiting, ported from axiomtrade-rs/src/utils/{retry,rate_limiter}.rs.
 * Defaults match the Rust SDK: 3 retries, 100ms initial delay, exp base 2,
 * 30s cap, full jitter; token bucket of 100 requests / 60s.
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
}

export const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 30_000,
  exponentialBase: 2,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffDelay(attempt: number, cfg: RetryConfig): number {
  const exp = cfg.initialDelayMs * cfg.exponentialBase ** attempt;
  const capped = Math.min(exp, cfg.maxDelayMs);
  // Full jitter, as in retry.rs: uniform in [0, capped].
  return Math.random() * capped;
}

/** Thrown/returned by an operation to signal it should not be retried. */
export class NonRetryableError extends Error {}

export async function retry<T>(
  operation: () => Promise<T>,
  cfg: RetryConfig = DEFAULT_RETRY,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastErr = err;
      if (err instanceof NonRetryableError) throw err;
      if (attempt < cfg.maxRetries) await sleep(backoffDelay(attempt, cfg));
    }
  }
  throw lastErr;
}

/**
 * Token-bucket limiter (rate_limiter.rs). Client-side politeness so the
 * extension never hammers Axiom harder than a human session would.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly refillRate: number; // tokens per second

  constructor(
    private readonly capacity = 100,
    windowMs = 60_000,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.refillRate = capacity / (windowMs / 1000);
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const deficit = 1 - this.tokens;
      await sleep((deficit / this.refillRate) * 1000);
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
