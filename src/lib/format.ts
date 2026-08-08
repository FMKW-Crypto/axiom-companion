/** Display helpers shared by the in-page UIs. */

export function shortAddr(a: string | null | undefined): string {
  if (!a) return "—";
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
