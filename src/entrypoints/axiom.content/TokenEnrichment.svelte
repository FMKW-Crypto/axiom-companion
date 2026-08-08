<script lang="ts">
  import { sendMessage } from "@/lib/bridge/messages";
  import type { TokenInfo, TokenAnalysis } from "@/lib/models/market";

  let { tokenAddress }: { tokenAddress: string } = $props();

  let info = $state<TokenInfo | null>(null);
  let analysis = $state<TokenAnalysis | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Refetch whenever the SPA navigates to a different token. `stale` guards
  // against a slow response for the previous token landing after the user has
  // already navigated on.
  $effect(() => {
    const addr = tokenAddress;
    let stale = false;
    loading = true;
    error = null;
    info = null;
    analysis = null;

    (async () => {
      try {
        const raw = await sendMessage({ type: "getTokenInfo", address: addr });
        if (stale) return;
        info = raw;
        const ticker = info?.tokenTicker;
        if (ticker) {
          const a = await sendMessage({ type: "getTokenAnalysis", ticker });
          if (stale) return;
          analysis = a;
        }
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

  const riskClass = $derived(
    analysis?.creatorRiskLevel?.toLowerCase() === "high"
      ? "text-destructive"
      : analysis?.creatorRiskLevel?.toLowerCase() === "medium"
        ? "text-warning"
        : "text-success",
  );
</script>

<section class="rounded-none border border-border bg-card p-3">
  {#if loading}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if error}
    <p class="text-sm text-destructive">{error}</p>
  {:else if analysis}
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
      <span class="text-muted-foreground">Creator risk</span>
      <span class={`text-right font-medium ${riskClass}`}>
        {analysis.creatorRiskLevel ?? "—"}
      </span>
      <span class="text-muted-foreground">Rug count</span>
      <span class="text-right font-mono">{analysis.creatorRugCount ?? "—"}</span>
      <span class="text-muted-foreground">Tokens by creator</span>
      <span class="text-right font-mono">{analysis.creatorTokenCount ?? "—"}</span>
    </div>
  {:else}
    <p class="text-sm text-muted-foreground">No creator data for this token.</p>
  {/if}
</section>
