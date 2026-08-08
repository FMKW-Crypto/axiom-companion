<script lang="ts">
  import { onMount } from "svelte";
  import { sendMessage } from "@/lib/bridge/messages";
  import { shortAddr } from "@/lib/format";

  let wallets = $state<string[]>([]);

  onMount(async () => {
    try {
      wallets = await sendMessage({ type: "getKnownWallets" });
    } catch {
      wallets = [];
    }
  });
</script>

<main class="w-72 space-y-3 p-4 text-sm">
  <h1 class="font-heading text-base font-semibold tracking-tight">
    Axiom <span class="text-primary">Companion</span>
  </h1>

  <section class="rounded-none border border-border bg-card p-3">
    <div class="text-[10px] uppercase text-muted-foreground">Detected wallets</div>
    {#if wallets.length}
      <ul class="mt-1 space-y-0.5 font-mono text-xs">
        {#each wallets.slice(0, 5) as w (w)}
          <li class="truncate" title={w}>{shortAddr(w)}</li>
        {/each}
      </ul>
    {:else}
      <p class="mt-1 text-xs text-muted-foreground">
        None yet — open your portfolio on axiom.trade.
      </p>
    {/if}
  </section>

  <p class="text-[10px] text-muted-foreground">
    Read-only companion: portfolio overlay and token enrichment injected into
    axiom.trade. It never places trades.
  </p>
</main>
