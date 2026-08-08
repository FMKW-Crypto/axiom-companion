<script lang="ts">
  import { onMount } from "svelte";
  import { sendMessage } from "@/lib/bridge/messages";
  import { settingsItem, sessionSpentItem, type Settings } from "@/lib/settings";
  import type { Simulation } from "@/lib/models/trading";
  import { sol } from "@/lib/format";

  let { tokenAddress }: { tokenAddress: string } = $props();

  let settings = $state<Settings | null>(null);
  let pending = $state<number | null>(null); // amount awaiting confirm
  let sim = $state<Simulation | null>(null);
  let busy = $state(false);
  let message = $state<string | null>(null);
  let spent = $state(0);

  onMount(() => {
    settingsItem.getValue().then((s) => (settings = s));
    sessionSpentItem.getValue().then((v) => (spent = v));
    const unwatch = settingsItem.watch((s) => (settings = s));
    return unwatch;
  });

  async function startBuy(amountSol: number) {
    message = null;
    sim = null;
    if (!settings) return;
    if (spent + amountSol > settings.sessionSpendCapSol) {
      message = `Blocked: would exceed session cap of ${sol(settings.sessionSpendCapSol)}.`;
      return;
    }
    busy = true;
    try {
      // Dry-run first — never surface a confirm we haven't simulated.
      sim = await sendMessage({
        type: "simulateBuy",
        mint: tokenAddress,
        amountSol,
        slippage: settings.slippagePercent,
      });
      if (sim && sim.success === false) {
        message = `Simulation failed: ${sim.error ?? "unknown"}`;
        pending = null;
      } else {
        pending = amountSol;
      }
    } catch (err) {
      message = err instanceof Error ? err.message : "Simulation error";
    } finally {
      busy = false;
    }
  }

  async function confirmBuy() {
    if (pending == null || !settings) return;
    const amountSol = pending;
    busy = true;
    message = null;
    try {
      await sendMessage({
        type: "executeBuy",
        mint: tokenAddress,
        amountSol,
        slippage: settings.slippagePercent,
      });
      spent += amountSol;
      await sessionSpentItem.setValue(spent);
      message = `Submitted buy for ${sol(amountSol)}.`;
    } catch (err) {
      message = err instanceof Error ? err.message : "Trade failed";
    } finally {
      busy = false;
      pending = null;
      sim = null;
    }
  }

  function cancel() {
    pending = null;
    sim = null;
    message = null;
  }
</script>

<section class="rounded-none border border-border bg-card p-3">
  <h2
    class="font-heading mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
  >
    Quick buy
  </h2>

  {#if !settings}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if !settings.quickTradeEnabled}
    <p class="text-sm text-muted-foreground">
      Quick-trade is off. Enable it in the extension popup to arm buy presets.
    </p>
  {:else if pending != null}
    <div class="space-y-2">
      <p class="text-sm">
        Confirm buy <span class="font-mono">{sol(pending)}</span>
        at {settings.slippagePercent}% slippage?
      </p>
      {#if sim}
        <p class="text-xs text-muted-foreground">
          Simulation OK{sim.unitsConsumed ? ` · ${sim.unitsConsumed} CU` : ""}.
        </p>
      {/if}
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-none bg-primary px-2 py-1 text-xs font-medium
                 text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          onclick={confirmBuy}
          disabled={busy}
        >
          Confirm
        </button>
        <button
          class="flex-1 rounded-none border border-border px-2 py-1 text-xs
                 font-medium hover:bg-muted disabled:opacity-50"
          onclick={cancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </div>
  {:else}
    <div class="flex flex-wrap gap-2">
      {#each settings.buyPresetsSol as amount (amount)}
        <button
          class="rounded-none border border-border bg-muted px-3 py-1 text-xs font-medium
                 hover:border-primary hover:text-primary disabled:opacity-50"
          onclick={() => startBuy(amount)}
          disabled={busy}
        >
          {amount} SOL
        </button>
      {/each}
    </div>
    <p class="mt-2 text-[10px] text-muted-foreground">
      Session spent: {sol(spent)} / {sol(settings.sessionSpendCapSol)}
    </p>
  {/if}

  {#if message}
    <p class="mt-2 text-xs text-muted-foreground">{message}</p>
  {/if}
</section>
