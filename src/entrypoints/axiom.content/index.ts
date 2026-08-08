import { mount, unmount } from "svelte";
import App from "./App.svelte";
import { registerThemeFonts } from "@/lib/styles/documentFonts";
import { currentTokenAddress } from "@/lib/tokenPage";
import { findSidebar } from "@/lib/sidebar";
import "@/lib/styles/theme.css";

/**
 * Isolated-world content script. Mounts the Svelte UI inside a shadow root so
 * the FMKW theme never collides with axiom.trade's own styles.
 *
 * Placement: on token pages the panel is inserted at the top of the site's own
 * right sidebar (found geometrically — see lib/sidebar.ts), so it reads as part
 * of the page. When no sidebar exists (narrow window, redesign) it falls back
 * to a floating overlay. Axiom is an SPA, so a 1s watcher re-anchors after
 * client-side navigations and re-mounts if a re-render swallowed the host.
 */
export default defineContentScript({
  matches: ["https://axiom.trade/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    // The panel's fonts have to live in the page document, not the shadow root.
    // Not awaited: the UI is legible in the fallback stack and swaps when the
    // faces land, which beats holding the mount on three network reads.
    registerThemeFonts();

    let target: HTMLElement | null = null; // anchor of the current mount
    let inlineMode = false;

    const ui = await createShadowRootUi(ctx, {
      name: "axiom-companion-root",
      position: "inline",
      anchor: () => target,
      append: "first",
      onMount: (container) => {
        // Tokens come from `:host`; this only makes the `dark:` variant — which
        // keys off an ancestor `.dark` — resolve inside the shadow root too.
        container.classList.add("dark");
        return mount(App, { target: container, props: { inline: inlineMode } });
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });

    const sync = () => {
      const onTokenPage = currentTokenAddress() != null;
      const sidebar = onTokenPage ? findSidebar() : null;
      const desired = onTokenPage ? (sidebar ?? document.body) : null;

      const host = document.querySelector("axiom-companion-root");
      const attached = host?.isConnected ?? false;

      if (!desired) {
        if (attached) ui.remove();
        target = null;
        return;
      }
      if (attached && target === desired) return;

      ui.remove();
      target = desired;
      inlineMode = desired !== document.body;
      ui.mount();
      const mountedHost = document.querySelector("axiom-companion-root");
      if (mountedHost instanceof HTMLElement) {
        // Custom elements default to inline; the panel needs block flow when it
        // sits inside the sidebar (harmless in overlay mode — the panel there
        // is position:fixed and out of flow anyway).
        mountedHost.style.display = "block";
      }
    };

    sync();
    ctx.setInterval(sync, 1_000);
  },
});
