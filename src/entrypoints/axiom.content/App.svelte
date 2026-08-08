<script lang="ts">
  import { onMount } from "svelte";
  import PortfolioPanel from "./PortfolioPanel.svelte";
  import TokenEnrichment from "./TokenEnrichment.svelte";
  import QuickTrade from "./QuickTrade.svelte";
  import { currentTokenAddress } from "@/lib/tokenPage";

  let open = $state(true);
  let tokenAddress = $state<string | null>(currentTokenAddress());

  // Axiom is an SPA — the path changes without a reload. Re-detect on nav.
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
  {#if open}
    <aside
      class="fixed right-3 top-16 z-[2147483000] flex max-h-[85vh] w-80 flex-col
             overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
    >
      <header
        class="flex items-center justify-between border-b border-border px-3 py-2"
      >
        <span class="text-sm font-semibold tracking-tight">
          Axiom <span class="text-primary">Companion</span>
        </span>
        <button
          class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
          onclick={() => (open = false)}
          aria-label="Collapse panel"
        >
          ✕
        </button>
      </header>

      <div class="flex-1 space-y-3 overflow-y-auto p-3">
        <PortfolioPanel />
        {#if tokenAddress}
          <TokenEnrichment {tokenAddress} />
          <QuickTrade {tokenAddress} />
        {/if}
      </div>
    </aside>
  {:else}
    <button
      class="fixed right-3 top-16 z-[2147483000] rounded-full border border-border
             bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground
             shadow-lg hover:opacity-90"
      onclick={() => (open = true)}
    >
      Axiom Companion
    </button>
  {/if}
</div>
