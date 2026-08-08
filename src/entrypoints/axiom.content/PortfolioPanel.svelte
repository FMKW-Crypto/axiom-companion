<script lang="ts">
  import { onMount } from "svelte";
  import { sendMessage } from "@/lib/bridge/messages";
  import type { PortfolioV5Response, Position } from "@/lib/models/portfolio";
  import { usd, sol, pct, signClass } from "@/lib/format";

  type State =
    | { status: "loading" }
    | { status: "no-wallets" }
    | { status: "error"; message: string }
    | { status: "ready"; data: PortfolioV5Response };

  let state = $state<State>({ status: "loading" });

  async function refresh() {
    try {
      const wallets = await sendMessage({ type: "getKnownWallets" });
      if (wallets.length === 0) {
        state = { status: "no-wallets" };
        return;
      }
      const data = await sendMessage({ type: "getPortfolio", wallets });
      state = { status: "ready", data };
    } catch (err) {
      state = {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load",
      };
    }
  }

  onMount(() => {
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  });

  const activePositions = $derived(
    state.status === "ready" ? (state.data.activePositions ?? []) : [],
  );
  const balanceStats = $derived(
    state.status === "ready" ? state.data.balanceStats : undefined,
  );
</script>

<section class="rounded-md border border-border bg-background p-3">
  <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    Portfolio
  </h2>

  {#if state.status === "loading"}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if state.status === "no-wallets"}
    <p class="text-sm text-muted-foreground">
      No wallet detected yet. Browse your portfolio on axiom.trade and it will
      appear here.
    </p>
  {:else if state.status === "error"}
    <p class="text-sm text-[var(--brand-negative)]">{state.message}</p>
  {:else}
    <div class="mb-3 grid grid-cols-2 gap-2">
      <div class="rounded bg-card p-2">
        <div class="text-[10px] uppercase text-muted-foreground">Value</div>
        <div class="font-mono text-sm">{sol(balanceStats?.totalValueSol)}</div>
      </div>
      <div class="rounded bg-card p-2">
        <div class="text-[10px] uppercase text-muted-foreground">Unrealized</div>
        <div class={`font-mono text-sm ${signClass(balanceStats?.unrealizedPnlSol)}`}>
          {sol(balanceStats?.unrealizedPnlSol)}
        </div>
      </div>
    </div>

    {#if activePositions.length === 0}
      <p class="text-sm text-muted-foreground">No open positions.</p>
    {:else}
      <ul class="space-y-1">
        {#each activePositions.slice(0, 8) as p (p.tokenAddress ?? p.symbol)}
          {@render positionRow(p)}
        {/each}
      </ul>
    {/if}
  {/if}
</section>

{#snippet positionRow(p: Position)}
  <li class="flex items-center justify-between rounded px-1 py-1 text-sm hover:bg-muted">
    <span class="truncate font-medium">{p.symbol ?? "?"}</span>
    <span class="flex items-center gap-2">
      <span class="font-mono text-xs text-muted-foreground">{usd(p.valueUsd)}</span>
      <span class={`font-mono text-xs ${signClass(p.pnlPercent)}`}>{pct(p.pnlPercent)}</span>
    </span>
  </li>
{/snippet}
