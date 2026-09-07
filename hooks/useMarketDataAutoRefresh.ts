import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { useMarketDataStore } from "@/store/marketDataStore";
import type { Investment } from "@/types/models";

/**
 * Refreshes live quotes on the configured interval, but skips the tick
 * entirely while the window is hidden (minimized / not the active app) —
 * WealthOS should not keep polling free-tier APIs in the background when
 * nobody is looking at it (rule #29). `document.visibilitychange` fires
 * naturally in Electron's renderer when the window is minimized/restored.
 *
 * `document` does not exist at all on React Native's native runtime (it's
 * not merely `undefined`, it's an undeclared global) — every reference is
 * guarded with `typeof document !== "undefined"` so this hook never throws
 * there, even though 0.2.0 currently only ships on Electron/web.
 *
 * The interval closure reads `investmentsRef.current` rather than closing
 * over `investments` directly, so a portfolio change (e.g. adding a new
 * live-linked investment) is picked up by the very next tick without
 * needing to tear down and rebuild the interval — the interval itself only
 * resets when `enabled`/`autoRefresh`/`refreshIntervalMinutes` change.
 */
export function useMarketDataAutoRefresh(): void {
  const enabled = useSettingsStore((s) => s.marketData.enabled);
  const autoRefresh = useSettingsStore((s) => s.marketData.autoRefresh);
  const refreshIntervalMinutes = useSettingsStore((s) => s.marketData.refreshIntervalMinutes);
  const markMarketDataUpdated = useSettingsStore((s) => s.markMarketDataUpdated);
  const investments = useInvestmentsStore((s) => s.investments);
  const refreshAll = useMarketDataStore((s) => s.refreshAll);

  const investmentsRef = useRef<Investment[]>(investments);
  useEffect(() => {
    investmentsRef.current = investments;
  }, [investments]);

  useEffect(() => {
    if (!enabled || !autoRefresh) return;

    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      await refreshAll(investmentsRef.current);
      await markMarketDataUpdated();
    };

    tick();
    const intervalId = setInterval(tick, Math.max(1, refreshIntervalMinutes) * 60 * 1000);

    const handleVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        tick();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, autoRefresh, refreshIntervalMinutes]);
}
