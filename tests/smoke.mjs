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
  const hasToggle = await popup.getByText("Enable quick-trade").isVisible();
  const hasSave = await popup.getByRole("button", { name: /save/i }).isVisible();
  const bg = await popup.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  hasToggle ? ok("popup shows quick-trade toggle") : fail("popup missing toggle");
  hasSave ? ok("popup shows save button") : fail("popup missing save button");
  // The theme must actually paint — not the transparent/white default. The
  // token resolves to FMKW's brand-base, which Chromium reports as an oklch()
  // value with a low lightness (first component ~0.16).
  const isDefault = bg === "rgba(0, 0, 0, 0)" || bg === "rgb(255, 255, 255)";
  const oklchL = Number(bg.match(/oklch\(\s*([\d.]+)/)?.[1] ?? "1");
  !isDefault && oklchL < 0.3
    ? ok(`popup uses dark FMKW theme (body bg ${bg})`)
    : fail(`popup body bg not themed dark: ${bg}`);

  // 3. Content script injects on an axiom.trade page.
  const page = await ctx.newPage();
  await page.route("https://axiom.trade/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><head><title>Axiom</title></head><body><main>token</main></body></html>",
    }),
  );
  await page.goto("https://axiom.trade/portfolio");
  // The host element is present but zero-size (its panel is position:fixed), so
  // wait for it attached rather than visible.
  const host = await page.waitForSelector("axiom-companion-root", {
    state: "attached",
    timeout: 10_000,
  });
  ok("content script mounted shadow-root host <axiom-companion-root>");
  const panelText = await host.evaluate(
    (el) => el.shadowRoot?.textContent ?? "",
  );
  panelText.includes("Companion")
    ? ok("in-page panel rendered Companion header")
    : fail(`panel content unexpected: ${panelText.slice(0, 80)}`);
  panelText.includes("Portfolio")
    ? ok("portfolio section rendered")
    : fail("portfolio section missing");

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
