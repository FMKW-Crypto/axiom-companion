/**
 * Detects which token (if any) the current axiom.trade page is showing.
 * Axiom routes token pages under paths like /meme/<pairOrMint> and /t/<mint>;
 * we pull the first base58-shaped path segment. Returns null on non-token pages
 * (portfolio, home, settings), so token-specific UI hides rather than guesses.
 */
const BASE58_SEG = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function currentTokenAddress(pathname = window.location.pathname): string | null {
  const segments = pathname.split("/").filter(Boolean);
  for (const seg of segments) {
    if (BASE58_SEG.test(seg)) return seg;
  }
  return null;
}
