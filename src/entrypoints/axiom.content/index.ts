import { mount, unmount } from "svelte";
import App from "./App.svelte";
import { sendMessage } from "@/lib/bridge/messages";
import { registerThemeFonts } from "@/lib/styles/documentFonts";
import "@/lib/styles/theme.css";

/**
 * Isolated-world content script. Mounts the Svelte UI inside a shadow root so
 * the FMKW theme never collides with axiom.trade's own styles, and bridges the
 * MAIN-world interceptor to the background worker.
 */
export default defineContentScript({
  matches: ["https://axiom.trade/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    // The panel's fonts have to live in the page document, not the shadow root.
    // Not awaited: the UI is legible in the fallback stack and swaps when the
    // faces land, which beats holding the mount on three network reads.
    registerThemeFonts();

    // Relay wallets the interceptor discovered in the page's own traffic.
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data as {
        source?: string;
        kind?: string;
        wallets?: string[];
      };
      if (data?.source !== "axiom-companion") return;
      if (data.kind === "wallets" && data.wallets?.length) {
        sendMessage({ type: "reportWallets", wallets: data.wallets }).catch(
          () => {},
        );
      }
    });

    const ui = await createShadowRootUi(ctx, {
      name: "axiom-companion-root",
      position: "overlay",
      anchor: "body",
      append: "last",
      onMount: (container) => {
        // Tokens come from `:host`; this only makes the `dark:` variant — which
        // keys off an ancestor `.dark` — resolve inside the shadow root too.
        container.classList.add("dark");
        return mount(App, { target: container });
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });

    ui.mount();
  },
});
