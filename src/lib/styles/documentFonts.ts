import oxanium from "@fontsource-variable/oxanium/files/oxanium-latin-wght-normal.woff2?url";
import spaceGrotesk from "@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url";
import geistMono from "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url";

/**
 * Chrome ignores `@font-face` declared inside a shadow root — a face has to be
 * in the *document's* font set before shadow content can use it. The content
 * script's stylesheet therefore cannot carry the fonts the way `fonts.css` does
 * for the popup, and without this the injected panel silently falls back to
 * whatever axiom.trade renders in.
 *
 * Only the `latin` subset of each family is registered. The panel shows English
 * copy, numbers, and base58; the `latin-ext`, `cyrillic`, and `vietnamese`
 * subsets `@fontsource-variable` also ships would cost bytes for glyphs that
 * never appear, and anything outside the subset falls through to the next family
 * in the stack anyway.
 *
 * The bytes are handed to `FontFace` as an `ArrayBuffer` rather than left as a
 * `url()` descriptor. A `url()` is resolved by the page, which puts the request
 * under axiom.trade's `font-src` policy and would need the file to be
 * web-accessible; reading it here instead keeps the load inside the isolated
 * world, where the page's CSP does not apply.
 */

/** Weight ranges are the variable axis each `@fontsource-variable` build ships. */
const FACES = [
  { family: "Oxanium Variable", weight: "200 800", path: oxanium },
  { family: "Space Grotesk Variable", weight: "300 700", path: spaceGrotesk },
  { family: "Geist Mono Variable", weight: "100 900", path: geistMono },
] as const;

/**
 * WXT builds content scripts in library mode, where Vite inlines imported assets
 * regardless of `assetsInlineLimit` — so in practice these arrive as `data:`
 * URIs and load with no request at all. The `getURL` branch is what makes the
 * other case work: an emitted file resolves to a root-relative path, which
 * `fetch` would otherwise send to axiom.trade rather than to the extension.
 * `assets/*.woff2` is declared web-accessible for exactly that path.
 */
function resolve(path: string): string {
  if (path.startsWith("data:")) return path;
  return browser.runtime.getURL(path as Parameters<typeof browser.runtime.getURL>[0]);
}

/**
 * Registers the theme's faces on the top-level document. Safe to call more than
 * once: families already present are skipped, so a re-mounted UI does not reload
 * them. Individual failures are swallowed — a missing web font degrades to the
 * fallback stack, which is not worth tearing the panel down over.
 */
export async function registerThemeFonts(): Promise<void> {
  const present = new Set<string>();
  document.fonts.forEach((face) => present.add(face.family));

  await Promise.all(
    FACES.map(async ({ family, weight, path }) => {
      if (present.has(family)) return;
      try {
        const data = await (await fetch(resolve(path))).arrayBuffer();
        const face = new FontFace(family, data, {
          weight,
          style: "normal",
          display: "swap",
        });
        document.fonts.add(await face.load());
      } catch {
        // Fallback stack takes over.
      }
    }),
  );
}
