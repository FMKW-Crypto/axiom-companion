import { mount } from "svelte";
import App from "./App.svelte";
import "@/lib/styles/fonts.css";
import "@/lib/styles/theme.css";

const target = document.getElementById("app");
if (target) {
  mount(App, { target });
}
