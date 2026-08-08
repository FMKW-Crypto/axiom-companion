import { mount } from "svelte";
import App from "./App.svelte";
import "@/lib/styles/theme.css";

// Paint the popup chrome itself, not just the mounted root, so there is no
// white gutter around the themed UI.
document.documentElement.classList.add("dark");
document.body.classList.add("font-sans", "bg-background", "text-foreground");

const target = document.getElementById("app");
if (target) {
  mount(App, { target });
}
