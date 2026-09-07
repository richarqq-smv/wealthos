import { useEffect } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { useMarketDataStore } from "@/store/marketDataStore";

/**
 * Refreshes live quotes on the configured interval, but skips the tick
 * entirely while the window is hidden (minimized / not the active app) —
 * WealthOS should not keep polling free-tier APIs in the background when
 * nobody is looking at it (rule #29). `document.visibilitychange` fires
 * naturally in Electron's renderer when the window is minimized/restored.
 */
export function useMarketDataAutoRefresh(): void {
  const enabled = useSettingsStore((s) => s.marketData.enabled);
  const autoRefresh = useSettingsStore((s) => s.marketData.autoRefresh);
  const refreshIntervalMinutes = useSettingsStore((s) => s.marketData.refreshIntervalMinutes);
  const markMarketDataUpdated = useSettingsStore((s) => s.markMarketDataUpdated);
  const investments = useInvestmentsStore((s) => s.investments);
  const refreshAll = useMarketDataStore((s) => s.refreshAll);

  useEffect(() => {
    if (!enabled || !autoRefresh) return;

    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      await refreshAll(investments);
      await markMarketDataUpdated();
    };

    tick();
    const intervalId = setInterval(tick, Math.max(1, refreshIntervalMinutes) * 60 * 1000);

    const handleVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        tick();
      }
    };
    document.addEventListener?.("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener?.("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, autoRefresh, refreshIntervalMinutes]);
}
