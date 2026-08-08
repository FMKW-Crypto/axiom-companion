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
      "Portfolio overlay and token enrichment for axiom.trade.",
    permissions: ["storage", "cookies", "alarms"],
    host_permissions: ["https://axiom.trade/*", "https://*.axiom.trade/*"],
    // The content script fetches the theme's woff2 files to register them on the
    // page document (see `lib/styles/documentFonts.ts`); an extension resource a
    // content script reads has to be web-accessible. Scoped to axiom.trade so
    // the files are not readable from any other origin.
    web_accessible_resources: [
      {
        resources: ["assets/*.woff2"],
        matches: ["https://axiom.trade/*"],
      },
    ],
  },
});
