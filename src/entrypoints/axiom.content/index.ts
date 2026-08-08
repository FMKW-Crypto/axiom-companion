import { mount, unmount } from "svelte";
import App from "./App.svelte";
import { sendMessage } from "@/lib/bridge/messages";
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
        // The theme tokens are declared on :host; add the marker class the base
        // layer keys off so utilities resolve inside the shadow root.
        return mount(App, { target: container });
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });

    ui.mount();
  },
});
