<script lang="ts">
  import { sendMessage } from "@/lib/bridge/messages";
  import type { EarlyBuyer } from "@/lib/models/snipers";
  import { shortAddr } from "@/lib/format";

  let { tokenAddress }: { tokenAddress: string } = $props();

  let buyers = $state<EarlyBuyer[] | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // The /meme/<address> URL segment is the pair address, which is exactly what
  // sniper-transactions-v3 keys on. Same stale-guard pattern as TokenEnrichment.
  $effect(() => {
    const addr = tokenAddress;
    let stale = false;
    loading = true;
    error = null;
    buyers = null;

    (async () => {
      try {
        const res = await sendMessage({
          type: "getEarlyBuyers",
          pairAddress: addr,
        });
        if (stale) return;
        buyers = res;
      } catch (err) {
        if (stale) return;
        error = err instanceof Error ? err.message : "Failed to load";
      } finally {
        if (!stale) loading = false;
      }
    })();

    return () => {
      stale = true;
    };
  });

  const holding = $derived(
    buyers?.filter((b) => b.status === "holding").length ?? 0,
  );

  const sol = (n: number) =>
    n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toFixed(3);

  const statusClass: Record<EarlyBuyer["status"], string> = {
    holding: "text-success",
    partial: "text-warning",
    sold: "text-destructive",
  };
  const statusLabel: Record<EarlyBuyer["status"], string> = {
    holding: "holds",
    partial: "part",
    sold: "sold",
  };
</script>

<section class="rounded-none border border-border bg-card p-3">
  <h2
    class="font-heading mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
  >
    Early buyers
  </h2>

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if error}
    <p class="text-sm text-destructive">{error}</p>
  {:else if !buyers || buyers.length === 0}
    <p class="text-sm text-muted-foreground">No early-buyer data.</p>
  {:else}
    <p class="mb-2 text-xs text-muted-foreground">
      {buyers.length} wallet{buyers.length === 1 ? "" : "s"} ·
      <span class={holding > 0 ? "text-success" : ""}>{holding} still holding</span>
    </p>
    <ul class="max-h-48 space-y-1 overflow-y-auto pr-1 text-xs">
      {#each buyers as b (b.wallet)}
        <li class="flex items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-1.5">
            {#if b.group === "instant"}
              <span title="Sniped the launch block" class="text-warning">⚡</span>
            {/if}
            <span class="truncate font-mono">{shortAddr(b.wallet)}</span>
          </span>
          <span class="flex shrink-0 items-center gap-2 font-mono">
            <span title="SOL spent buying">{sol(b.solSpent)}◎</span>
            <span
              class={`w-10 text-right font-sans font-medium ${statusClass[b.status]}`}
            >
              {statusLabel[b.status]}
            </span>
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
