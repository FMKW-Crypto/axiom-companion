import { RateLimiter, retry, NonRetryableError } from "@/lib/utils/net";

/**
 * HTTP core, ported from axiomtrade-rs/src/auth/client.rs.
 *
 * Key difference from the Rust SDK: the SDK logs in with email/password/OTP and
 * manages `auth-access-token` / `auth-refresh-token` itself. The extension does
 * none of that — it runs in the browser where the user is already logged in, so
 * the auth cookies ride along automatically on every request via
 * `credentials: "include"` (the manifest's host_permissions cover
 * *.axiom.trade). We only replicate the SDK's *refresh* flow for the case where
 * the access token has expired mid-session.
 *
 * This runs in the background service worker so requests are not subject to the
 * page's CORS context and cookies are attached by the browser.
 */

// From auth/client.rs API_ENDPOINTS.
const API_ENDPOINTS = [
  "https://api2.axiom.trade",
  "https://api3.axiom.trade",
  "https://api6.axiom.trade",
  "https://api7.axiom.trade",
  "https://api8.axiom.trade",
  "https://api9.axiom.trade",
  "https://api10.axiom.trade",
] as const;

const MAIN_ORIGIN = "https://axiom.trade";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super("Unauthorized", 401);
    this.name = "UnauthorizedError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  /** Absolute URL, or a path resolved against a rotating api* endpoint. */
  url?: string;
  path?: string;
  body?: unknown;
  /** Whether to attempt a token refresh + retry once on 401. Default true. */
  refreshOn401?: boolean;
}

export class ApiClient {
  private endpointIndex = 0;
  private readonly limiter = new RateLimiter();

  private currentEndpoint(): string {
    return API_ENDPOINTS[this.endpointIndex % API_ENDPOINTS.length]!;
  }

  private rotateEndpoint(): void {
    this.endpointIndex = (this.endpointIndex + 1) % API_ENDPOINTS.length;
  }

  private headers(): HeadersInit {
    // Mirrors the header set built in auth/client.rs::new_with_user_agent.
    return {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: MAIN_ORIGIN,
      Referer: `${MAIN_ORIGIN}/`,
    };
  }

  /**
   * Replays auth/client.rs::refresh_token: POST /refresh-access-token with the
   * refresh cookie (sent automatically). On success the server sets a fresh
   * `auth-access-token` cookie which the browser stores for us.
   */
  private async refresh(): Promise<boolean> {
    const url = `${this.currentEndpoint()}/refresh-access-token`;
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async fetchJson<T = unknown>(
    fullUrl: string,
    method: string,
    body: unknown,
  ): Promise<T> {
    await this.limiter.acquire();
    const res = await fetch(fullUrl, {
      method,
      credentials: "include",
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 401) throw new UnauthorizedError();
    if (res.status === 400) {
      // Bad request is deterministic; retrying won't help.
      throw new NonRetryableError(await res.text().catch(() => "Bad request"));
    }
    if (!res.ok) {
      throw new ApiError(`Unexpected status ${res.status}`, res.status);
    }
    // Some endpoints return empty bodies; tolerate that.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async request<T = unknown>(opts: RequestOptions): Promise<T> {
    const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
    const refreshOn401 = opts.refreshOn401 ?? true;

    const resolve = () =>
      opts.url ?? `${this.currentEndpoint()}${opts.path ?? ""}`;

    return retry(async () => {
      try {
        return await this.fetchJson<T>(resolve(), method, opts.body);
      } catch (err) {
        if (err instanceof UnauthorizedError && refreshOn401) {
          const ok = await this.refresh();
          if (ok) return await this.fetchJson<T>(resolve(), method, opts.body);
          // Refresh failed → user is genuinely logged out; don't spin.
          throw new NonRetryableError("Not authenticated with axiom.trade");
        }
        // Network/5xx on an api* host: rotate to a sibling before retrying.
        if (!opts.url && !(err instanceof NonRetryableError)) {
          this.rotateEndpoint();
        }
        throw err;
      }
    });
  }
}

export { API_ENDPOINTS, MAIN_ORIGIN };
