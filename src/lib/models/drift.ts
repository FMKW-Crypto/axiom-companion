import type { ZodError } from "zod";

/**
 * Schema-drift reporter. The Axiom API has drifted since axiomtrade-rs was
 * written, so instead of silently coercing we log exactly which fields a real
 * response disagreed with our zod schema on. In the background worker this is a
 * console warning; the interceptor uses the same channel so live page traffic
 * and our own requests are checked against one source of truth.
 *
 * Kept side-effect-light on purpose: never throws, never blocks a response.
 */
export function reportDrift(
  endpoint: string,
  error: ZodError,
  raw: unknown,
): void {
  const issues = error.issues.slice(0, 8).map((i) => ({
    path: i.path.join("."),
    code: i.code,
    message: i.message,
  }));
  console.warn(
    `[axiom-companion] schema drift on "${endpoint}":`,
    issues,
    "\nsample:",
    raw,
  );
}
