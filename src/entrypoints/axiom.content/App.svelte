<script lang="ts">
  import { onMount } from "svelte";
  import TokenEnrichment from "./TokenEnrichment.svelte";
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

<!-- Token enrichment is the only feature, so the panel exists only on token pages. -->
<div class="ac-root font-sans text-foreground">
  {#if tokenAddress}
    {#if open}
      <aside
        class="fixed right-3 top-16 z-[2147483000] flex max-h-[85vh] w-80 flex-col
               overflow-hidden rounded-none border border-border bg-background shadow-2xl"
      >
        <header
          class="flex items-center justify-between border-b border-border px-3 py-2"
        >
          <span class="font-heading text-sm font-semibold tracking-tight">
            Axiom <span class="text-primary">Companion</span>
          </span>
          <button
            class="rounded-none px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            onclick={() => (open = false)}
            aria-label="Collapse panel"
          >
            ✕
          </button>
        </header>

        <div class="flex-1 space-y-3 overflow-y-auto p-3">
          <TokenEnrichment {tokenAddress} />
        </div>
      </aside>
    {:else}
      <button
        class="fixed right-3 top-16 z-[2147483000] rounded-none border border-transparent
               bg-primary px-3 py-2 text-xs font-medium text-primary-foreground
               shadow-lg hover:bg-primary/80"
        onclick={() => (open = true)}
      >
        Axiom Companion
      </button>
    {/if}
  {/if}
</div>
