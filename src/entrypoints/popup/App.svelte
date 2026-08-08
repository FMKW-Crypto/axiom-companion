<script lang="ts">
  import { onMount } from "svelte";
  import { sendMessage } from "@/lib/bridge/messages";
  import {
    settingsItem,
    DEFAULT_SETTINGS,
    type Settings,
  } from "@/lib/settings";

  let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  let wallets = $state<string[]>([]);
  let presetsText = $state("0.1, 0.5, 1");
  let saved = $state(false);

  onMount(async () => {
    settings = await settingsItem.getValue();
    presetsText = settings.buyPresetsSol.join(", ");
    try {
      wallets = await sendMessage({ type: "getKnownWallets" });
    } catch {
      wallets = [];
    }
  });

  async function save() {
    const presets = presetsText
      .split(",")
      .map((s) => Number.parseFloat(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    const next: Settings = {
      ...settings,
      buyPresetsSol: presets.length ? presets : DEFAULT_SETTINGS.buyPresetsSol,
    };
    await settingsItem.setValue(next);
    settings = next;
    saved = true;
    setTimeout(() => (saved = false), 1500);
  }
</script>

<main class="w-72 space-y-3 p-4 text-sm">
  <h1 class="text-base font-semibold">
    Axiom <span class="text-primary">Companion</span>
  </h1>

  <section class="rounded-md border border-border bg-card p-3">
    <div class="text-[10px] uppercase text-muted-foreground">Detected wallets</div>
    {#if wallets.length}
      <ul class="mt-1 space-y-0.5 font-mono text-xs">
        {#each wallets.slice(0, 5) as w (w)}
          <li class="truncate">{w}</li>
        {/each}
      </ul>
    {:else}
      <p class="mt-1 text-xs text-muted-foreground">
        None yet — open your portfolio on axiom.trade.
      </p>
    {/if}
  </section>

  <label class="flex items-center justify-between">
    <span>Enable quick-trade</span>
    <input type="checkbox" bind:checked={settings.quickTradeEnabled} />
  </label>

  <label class="block space-y-1">
    <span class="text-muted-foreground">Buy presets (SOL, comma-separated)</span>
    <input
      class="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs"
      bind:value={presetsText}
    />
  </label>

  <label class="block space-y-1">
    <span class="text-muted-foreground">Slippage %</span>
    <input
      type="number"
      min="0"
      max="100"
      step="0.5"
      class="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs"
      bind:value={settings.slippagePercent}
    />
  </label>

  <label class="block space-y-1">
    <span class="text-muted-foreground">Session spend cap (SOL)</span>
    <input
      type="number"
      min="0"
      step="0.1"
      class="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs"
      bind:value={settings.sessionSpendCapSol}
    />
  </label>

  <button
    class="w-full rounded bg-primary px-3 py-1.5 text-xs font-semibold
           text-primary-foreground hover:opacity-90"
    onclick={save}
  >
    {saved ? "Saved ✓" : "Save"}
  </button>

  {#if settings.quickTradeEnabled}
    <p class="text-[10px] text-[var(--brand-caution)]">
      Quick-trade armed. Every buy still requires an explicit in-page
      confirmation and is capped per session.
    </p>
  {/if}
</main>
