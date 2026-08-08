<script lang="ts">
  import { sendMessage } from "@/lib/bridge/messages";
  import type { TokenInfo, TokenAnalysis } from "@/lib/models/market";
  import { shortAddr } from "@/lib/format";

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
  <h2
    class="font-heading mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
  >
    Token
  </h2>

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if error}
    <p class="text-sm text-destructive">{error}</p>
  {:else}
    <div class="space-y-1 text-sm">
      <div class="flex items-center justify-between">
        <span class="font-semibold">{info?.tokenTicker ?? shortAddr(tokenAddress)}</span>
        <span class="font-mono text-xs text-muted-foreground">
          {shortAddr(tokenAddress)}
        </span>
      </div>
      {#if info?.tokenName}
        <div class="text-xs text-muted-foreground">{info.tokenName}</div>
      {/if}
      {#if analysis}
        <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span class="text-muted-foreground">Creator risk</span>
          <span class={`text-right font-medium ${riskClass}`}>
            {analysis.creatorRiskLevel ?? "—"}
          </span>
          <span class="text-muted-foreground">Rug count</span>
          <span class="text-right font-mono">{analysis.creatorRugCount ?? "—"}</span>
          <span class="text-muted-foreground">Tokens by creator</span>
          <span class="text-right font-mono">{analysis.creatorTokenCount ?? "—"}</span>
        </div>
      {/if}
    </div>
  {/if}
</section>
