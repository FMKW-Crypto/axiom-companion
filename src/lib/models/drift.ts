import type { ZodError } from "zod";

/**
 * Schema-drift reporter. The Axiom API may have drifted since axiomtrade-rs
 * was written, so instead of silently coercing we log exactly which fields a
 * real response disagreed with our zod schema on (a console warning in the
 * background worker).
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
