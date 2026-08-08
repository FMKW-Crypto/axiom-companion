/**
 * Browser smoke test: loads the built MV3 extension into a real Chromium and
 * verifies (1) the service worker registers, (2) the popup mounts the themed
 * Svelte UI, (3) the content script injects its shadow-root panel on a page
 * matching axiom.trade. Uses a fulfilled route so we never touch the real site
 * or a login — we only need a document at the axiom.trade origin.
 *
 * playwright-core is resolved from the FMKW workspace store; the extension is
 * the freshly built .output/chrome-mv3.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

// playwright-core lives (unhoisted) in the FMKW pnpm store; require it from
// its nested location so Node honours the package's exports map.
const pwDir =
  "/Users/flo/FMKW/FMKW/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core";
const require = createRequire(`${pwDir}/`);
const { chromium } = require("playwright-core");

const here = dirname(fileURLToPath(import.meta.url));
const extPath = resolve(here, "../.output/chrome-mv3");
const userDataDir = mkdtempSync(resolve(tmpdir(), "axiom-companion-"));

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`✓ ${msg}`);

// MV3 extensions do not load in Chromium's legacy headless mode; the new
// headless mode (--headless=new) does support them.
const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    "--headless=new",
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
});

try {
  // 1. Service worker registers → extension id.
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 10_000 });
  const extId = new URL(sw.url()).host;
  ok(`service worker registered (extension id ${extId})`);

  // 2. Popup mounts the Svelte UI with the theme applied.
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector("text=Axiom", { timeout: 10_000 });
  const hasBlurb = await popup.getByText("token enrichment").first().isVisible();
  const bg = await popup.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  hasBlurb
    ? ok("popup describes the token-enrichment feature")
    : fail("popup missing feature description");
  // The theme must actually paint — not the transparent/white default.
  // `--background` is FMKW's dark neutral, which Chromium reports as an oklch()
  // value with a low lightness (first component ~0.14).
  const isDefault = bg === "rgba(0, 0, 0, 0)" || bg === "rgb(255, 255, 255)";
  const oklchL = Number(bg.match(/oklch\(\s*([\d.]+)/)?.[1] ?? "1");
  !isDefault && oklchL < 0.3
    ? ok(`popup uses dark FMKW theme (body bg ${bg})`)
    : fail(`popup body bg not themed dark: ${bg}`);

  // 3. Content script injects on an axiom.trade page.
  const page = await ctx.newPage();
  // The stub page carries a sidebar-shaped right column (tall, 320px, right
  // edge) so the geometric anchor detection has something to find — this
  // exercises the real inline-mount path, not just the overlay fallback.
  await page.route("https://axiom.trade/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body:
        "<!doctype html><html><head><title>Axiom</title></head><body>" +
        '<main>token</main>' +
        // The sidebar hides behind two display:contents wrappers (0×0 rects),
        // mirroring the real axiom.trade DOM — the walker must descend through
        // them instead of pruning the subtree as "too narrow".
        '<div style="display:contents"><div style="display:contents">' +
        '<div id="sidebar" style="position:fixed;right:0;top:0;width:320px;height:100%">sidebar</div>' +
        "</div></div>" +
        "</body></html>",
    }),
  );
  // The panel only renders on token pages, so navigate to a token URL (the
  // route is fulfilled locally; the address just has to be base58-shaped).
  await page.goto(
    "https://axiom.trade/meme/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  );
  // The host element is present but zero-size (its panel is position:fixed), so
  // wait for it attached rather than visible.
  const host = await page.waitForSelector("axiom-companion-root", {
    state: "attached",
    timeout: 10_000,
  });
  ok("content script mounted shadow-root host <axiom-companion-root>");
  await page.waitForFunction(
    () =>
      document
        .querySelector("axiom-companion-root")
        ?.shadowRoot?.textContent?.includes("Companion") ?? false,
    null,
    { timeout: 10_000 },
  );
  const panelText = await host.evaluate(
    (el) => el.shadowRoot?.textContent ?? "",
  );
  ok("in-page panel rendered Companion header");
  // The enrichment section shows one of: the creator stats, a loading state,
  // or an error (this harness is unauthenticated, so an API error is the
  // steady state here) — any of them proves the section mounted.
  /Creator risk|Loading|No creator data|error|failed|authenticated/i.test(
    panelText,
  )
    ? ok("token enrichment section rendered")
    : fail(`token enrichment section missing (text: ${panelText.slice(0, 120)})`);
  const inSidebar = await host.evaluate(
    (el) => el.parentElement?.id === "sidebar",
  );
  inSidebar
    ? ok("panel anchored inline inside the sidebar column")
    : fail("panel not anchored in the sidebar (fell back to overlay?)");

  // 4. The panel's web fonts. A shadow root cannot register `@font-face`, so
  // these have to reach the *page* document via `documentFonts.ts` — the one
  // part of the theme that is not just a stylesheet, and the part that fails
  // silently (straight to the fallback stack) when it breaks.
  try {
    await page.waitForFunction(
      () =>
        ["Oxanium Variable", "Space Grotesk Variable", "Geist Mono Variable"]
          .every((family) =>
            [...document.fonts].some((face) => face.family === family),
          ),
      null,
      { timeout: 10_000 },
    );
    ok("theme fonts registered on the page document");
  } catch {
    const families = await page.evaluate(() =>
      [...document.fonts].map((f) => f.family),
    );
    fail(`theme fonts missing from page document: [${families.join(", ")}]`);
  }
  const panelFonts = await host.evaluate((el) => ({
    body: getComputedStyle(el.shadowRoot.querySelector(".ac-root")).fontFamily,
    heading: getComputedStyle(el.shadowRoot.querySelector(".font-heading"))
      .fontFamily,
  }));
  panelFonts.body.includes("Oxanium Variable") &&
  panelFonts.heading.includes("Space Grotesk Variable")
    ? ok("panel resolves Oxanium body / Space Grotesk heading")
    : fail(`panel font stack unexpected: ${JSON.stringify(panelFonts)}`);

  // Capture screenshots when a SHOT_DIR is provided (for visual review).
  const shotDir = process.env.SHOT_DIR;
  if (shotDir) {
    await popup.setViewportSize({ width: 320, height: 460 });
    await popup.screenshot({ path: `${shotDir}/popup.png` });
    await page.screenshot({ path: `${shotDir}/panel.png` });
    ok(`screenshots written to ${shotDir}`);
  }
} catch (err) {
  fail(`smoke test threw: ${err.message}`);
} finally {
  await ctx.close();
}

console.log(process.exitCode ? "\nSMOKE FAILED" : "\nSMOKE PASSED");
