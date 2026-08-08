import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-svelte"],
  srcDir: "src",
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "Axiom Companion",
    description:
      "Portfolio overlay, quick-trade and token enrichment for axiom.trade.",
    permissions: ["storage", "cookies", "alarms"],
    host_permissions: ["https://axiom.trade/*", "https://*.axiom.trade/*"],
  },
});
