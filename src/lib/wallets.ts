import { storage } from "#imports";

/**
 * Discovered wallet addresses persist across worker restarts (MV3 service
 * workers are killed aggressively). The interceptor reports wallets it sees in
 * the page's own traffic; the background worker stores them here so portfolio
 * refresh keeps working even after the worker has been recycled.
 */
const item = storage.defineItem<string[]>("local:knownWallets", {
  fallback: [],
});

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function addWallets(wallets: string[]): Promise<string[]> {
  const valid = wallets.filter((w) => BASE58.test(w));
  const current = await item.getValue();
  const merged = Array.from(new Set([...current, ...valid]));
  if (merged.length !== current.length) await item.setValue(merged);
  return merged;
}

export function getWallets(): Promise<string[]> {
  return item.getValue();
}
