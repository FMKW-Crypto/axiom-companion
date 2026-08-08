import { storage } from "#imports";

/**
 * User-controlled trade settings. Everything defaults to the safe position:
 * quick-trade OFF, empty presets, a conservative spend cap. Nothing can execute
 * a trade until the user opts in from the popup (PLAN §4 safety rails).
 */
export interface Settings {
  quickTradeEnabled: boolean;
  buyPresetsSol: number[];
  slippagePercent: number;
  /** Max total SOL the extension may spend per browser session. */
  sessionSpendCapSol: number;
}

export const DEFAULT_SETTINGS: Settings = {
  quickTradeEnabled: false,
  buyPresetsSol: [0.1, 0.5, 1],
  slippagePercent: 5,
  sessionSpendCapSol: 5,
};

export const settingsItem = storage.defineItem<Settings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
});

/** Session spend accounting lives in session storage so it resets per session. */
export const sessionSpentItem = storage.defineItem<number>(
  "session:spentSol",
  { fallback: 0 },
);
