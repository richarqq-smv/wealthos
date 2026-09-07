import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useMarketDataAutoRefresh } from "@/hooks/useMarketDataAutoRefresh";
import { useSettingsStore } from "@/store/settingsStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { useMarketDataStore } from "@/store/marketDataStore";
import type { Investment } from "@/types/models";

function investment(overrides: Partial<Investment> = {}): Investment {
  return {
    id: "i1",
    name: "Apple",
    ticker: "AAPL",
    type: "stock",
    quantity: 10,
    averagePriceMinor: 10_000,
    currentPriceMinor: 15_000,
    currency: "EUR",
    broker: "DEGIRO",
    purchaseDate: "2026-01-01T00:00:00.000Z",
    origin: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    providerSymbol: "AAPL",
    liveDataEnabled: true,
    ...overrides,
  };
}

function TestHarness() {
  useMarketDataAutoRefresh();
  return null;
}

/** No `@testing-library/react-native` renderHook helper is usable here (its
 * `test-renderer` peer resolves incorrectly in this environment) — this is a
 * minimal equivalent built directly on `react-test-renderer`, which is a
 * real, already-installed devDependency. */
function renderAutoRefreshHook(): { unmount: () => void } {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(TestHarness));
  });
  return { unmount: () => act(() => renderer.unmount()) };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const REFRESH_INTERVAL_MINUTES = 10;
const INTERVAL_MS = REFRESH_INTERVAL_MINUTES * 60 * 1000;

let refreshAllSpy: jest.Mock;
let markMarketDataUpdatedSpy: jest.Mock;

function enableAutoRefresh(investments: Investment[]) {
  refreshAllSpy = jest.fn().mockResolvedValue(undefined);
  markMarketDataUpdatedSpy = jest.fn().mockResolvedValue(undefined);

  act(() => {
    useSettingsStore.setState((state) => ({
      marketData: { ...state.marketData, enabled: true, autoRefresh: true, refreshIntervalMinutes: REFRESH_INTERVAL_MINUTES },
      markMarketDataUpdated: markMarketDataUpdatedSpy,
    }));
    useInvestmentsStore.setState({ investments });
    useMarketDataStore.setState({ refreshAll: refreshAllSpy });
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useMarketDataAutoRefresh — H1: native `document` safety", () => {
  it("does not throw when `document` is undefined (native-like runtime, the default jest-expo environment)", async () => {
    expect(typeof document).toBe("undefined");
    enableAutoRefresh([investment()]);

    let renderError: unknown = null;
    let harness: { unmount: () => void } | undefined;
    try {
      harness = renderAutoRefreshHook();
      await flush();
    } catch (error) {
      renderError = error;
    }

    expect(renderError).toBeNull();
    expect(refreshAllSpy).toHaveBeenCalled();

    // Cleanup (unmount) must also not throw when `document` is undefined.
    expect(() => harness?.unmount()).not.toThrow();
  });

  it("still registers/unregisters the visibilitychange listener correctly when `document` DOES exist (browser/Electron)", async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const fakeDocument = { hidden: false, addEventListener, removeEventListener };
    (globalThis as { document?: unknown }).document = fakeDocument;

    try {
      enableAutoRefresh([investment()]);
      const harness = renderAutoRefreshHook();
      await flush();

      expect(addEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
      harness.unmount();
      expect(removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });
});

describe("useMarketDataAutoRefresh — H2: stale closure / live investments snapshot", () => {
  it("Test A: refreshes an investment added after the hook started, on the very next tick, without changing refresh settings", async () => {
    const a = investment({ id: "a" });
    enableAutoRefresh([a]);

    renderAutoRefreshHook();
    await flush();
    expect(refreshAllSpy).toHaveBeenCalledTimes(1);
    expect(refreshAllSpy.mock.calls[0]?.[0]).toEqual([a]);

    // Investment B is added later — refresh settings (enabled/autoRefresh/interval) are untouched.
    const b = investment({ id: "b", ticker: "MSFT", providerSymbol: "MSFT" });
    act(() => {
      useInvestmentsStore.setState({ investments: [a, b] });
    });

    act(() => {
      jest.advanceTimersByTime(INTERVAL_MS);
    });
    await flush();

    expect(refreshAllSpy).toHaveBeenCalledTimes(2);
    const secondCallInvestments = refreshAllSpy.mock.calls[1]?.[0] as Investment[];
    expect(secondCallInvestments.map((inv) => inv.id).sort()).toEqual(["a", "b"]);
  });

  it("Test B: the interval is not torn down/rebuilt when only the investments list changes", async () => {
    const clearIntervalSpy = jest.spyOn(globalThis, "clearInterval");
    enableAutoRefresh([investment({ id: "a" })]);

    renderAutoRefreshHook();
    await flush();

    act(() => {
      useInvestmentsStore.setState({ investments: [investment({ id: "a" }), investment({ id: "b" })] });
    });
    await flush();

    // The effect (and therefore its interval) only depends on enabled/autoRefresh/refreshIntervalMinutes,
    // none of which changed here — so no interval should have been cleared yet (cleanup only fires on unmount/dep change).
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it("Test C: cleans up the interval and listener on unmount", async () => {
    const clearIntervalSpy = jest.spyOn(globalThis, "clearInterval");
    enableAutoRefresh([investment()]);

    const harness = renderAutoRefreshHook();
    await flush();

    harness.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    // No further ticks after unmount, even if enough time passes.
    refreshAllSpy.mockClear();
    act(() => {
      jest.advanceTimersByTime(INTERVAL_MS * 3);
    });
    await flush();
    expect(refreshAllSpy).not.toHaveBeenCalled();
  });

  it("Test D: skips a tick while the document is hidden, and catches up once visible again", async () => {
    let hidden = true;
    const listeners: Record<string, () => void> = {};
    const fakeDocument = {
      get hidden() {
        return hidden;
      },
      addEventListener: (event: string, handler: () => void) => {
        listeners[event] = handler;
      },
      removeEventListener: jest.fn(),
    };
    (globalThis as { document?: unknown }).document = fakeDocument;

    try {
      enableAutoRefresh([investment()]);
      renderAutoRefreshHook();
      await flush();

      // Initial tick ran while hidden — skipped.
      expect(refreshAllSpy).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(INTERVAL_MS);
      });
      await flush();
      // Still hidden — the interval tick is skipped too.
      expect(refreshAllSpy).not.toHaveBeenCalled();

      hidden = false;
      act(() => {
        listeners["visibilitychange"]?.();
      });
      await flush();
      expect(refreshAllSpy).toHaveBeenCalledTimes(1);
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });
});
