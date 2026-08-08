/** "EPjFWdd5…Dt1v" — the usual wallet/mint shorthand. */
export function shortAddr(a: string | null | undefined): string {
  if (!a) return "—";
  if (a.length <= 12) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
