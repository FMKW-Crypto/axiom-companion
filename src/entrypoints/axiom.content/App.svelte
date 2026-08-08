<script lang="ts">
  import { onMount } from "svelte";
  import TokenEnrichment from "./TokenEnrichment.svelte";
  import { currentTokenAddress } from "@/lib/tokenPage";

  // `inline` = mounted inside axiom's own sidebar; otherwise floating overlay.
  let { inline = false }: { inline?: boolean } = $props();

  let open = $state(true);
  let tokenAddress = $state<string | null>(currentTokenAddress());

  // Axiom is an SPA — the path changes without a reload. Re-detect on nav so
  // the enrichment refetches when the user hops between tokens.
  onMount(() => {
    const update = () => (tokenAddress = currentTokenAddress());
    window.addEventListener("popstate", update);
    const id = window.setInterval(update, 1500);
    return () => {
      window.removeEventListener("popstate", update);
      window.clearInterval(id);
    };
  });
</script>

<div class="ac-root font-sans text-foreground">
  {#if tokenAddress}
    <!-- Open and collapsed states share the same shell + header; collapsing
         only hides the body, so the panel never jumps or restyles. -->
    <aside
      class={inline
        ? "mb-2 flex w-full flex-col overflow-hidden border-b border-border bg-background"
        : "fixed right-3 top-16 z-[2147483000] flex max-h-[85vh] w-80 flex-col overflow-hidden rounded-none border border-border bg-background shadow-2xl"}
    >
      <header
        class={`flex items-center justify-between px-3 py-2 ${open ? "border-b border-border" : ""}`}
      >
        <span class="font-heading text-sm font-semibold tracking-tight">
          Axiom <span class="text-primary">Companion</span>
        </span>
        <button
          class="rounded-none px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onclick={() => (open = !open)}
          aria-label={open ? "Collapse panel" : "Expand panel"}
        >
          {#if open}
            <!-- chevron down -->
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          {:else}
            <!-- chevron up -->
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" aria-hidden="true">
              <path d="m18 15-6-6-6 6" />
            </svg>
          {/if}
        </button>
      </header>

      {#if open}
        <div class="flex-1 space-y-3 overflow-y-auto p-3">
          <TokenEnrichment {tokenAddress} />
        </div>
      {/if}
    </aside>
  {/if}
</div>
