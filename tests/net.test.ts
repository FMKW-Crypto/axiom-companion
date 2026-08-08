import { describe, it, expect, vi } from "vitest";
import { retry, RateLimiter, NonRetryableError } from "@/lib/utils/net";

const fast = { maxRetries: 3, initialDelayMs: 0, maxDelayMs: 0, exponentialBase: 2 };

describe("retry (ported from retry.rs)", () => {
  it("returns on first success without retrying", async () => {
    const op = vi.fn().mockResolvedValue("ok");
    expect(await retry(op, fast)).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxRetries then throws the last error", async () => {
    const op = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(retry(op, fast)).rejects.toThrow("boom");
    expect(op).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it("recovers if a later attempt succeeds", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue("recovered");
    expect(await retry(op, fast)).toBe("recovered");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("does not retry NonRetryableError", async () => {
    const op = vi.fn().mockRejectedValue(new NonRetryableError("stop"));
    await expect(retry(op, fast)).rejects.toThrow("stop");
    expect(op).toHaveBeenCalledTimes(1);
  });
});

describe("RateLimiter (token bucket)", () => {
  it("allows up to capacity without blocking", async () => {
    const rl = new RateLimiter(5, 60_000);
    const start = Date.now();
    for (let i = 0; i < 5; i++) await rl.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("delays once the bucket is empty", async () => {
    const rl = new RateLimiter(1, 1000); // refills 1 token/sec
    await rl.acquire();
    const start = Date.now();
    await rl.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(300);
  });
});
