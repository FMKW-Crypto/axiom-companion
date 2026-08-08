<script lang="ts">
  import { sendMessage } from "@/lib/bridge/messages";
  import type { TokenInfo, TokenAnalysis } from "@/lib/models/market";
  import { shortAddr } from "@/lib/format";

  let { tokenAddress }: { tokenAddress: string } = $props();

  let info = $state<TokenInfo | null>(null);
  let analysis = $state<TokenAnalysis | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Refetch whenever the SPA navigates to a different token.
  $effect(() => {
    const addr = tokenAddress;
    loading = true;
    error = null;
    info = null;
    analysis = null;

    (async () => {
      try {
        const raw = await sendMessage({ type: "getTokenInfo", address: addr });
        info = raw as TokenInfo | null;
        const ticker = info?.tokenTicker;
        if (ticker) {
          analysis = await sendMessage({ type: "getTokenAnalysis", ticker });
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "Failed to load";
      } finally {
        loading = false;
      }
    })();
  });

  const riskClass = $derived(
    analysis?.creatorRiskLevel?.toLowerCase() === "high"
      ? "text-[var(--brand-negative)]"
      : analysis?.creatorRiskLevel?.toLowerCase() === "medium"
        ? "text-[var(--brand-caution)]"
        : "text-[var(--brand-positive)]",
  );
</script>

<section class="rounded-md border border-border bg-background p-3">
  <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    Token
  </h2>

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if error}
    <p class="text-sm text-[var(--brand-negative)]">{error}</p>
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
