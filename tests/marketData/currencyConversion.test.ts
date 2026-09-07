import { buildFxLookup, convertAmountMinor } from "@/lib/marketData/currencyConversion";

describe("convertAmountMinor", () => {
  it("returns the amount unchanged when currencies match, without consulting the lookup", () => {
    const lookup = jest.fn();
    expect(convertAmountMinor(10_000, "EUR", "EUR", lookup)).toBe(10_000);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("converts using the rate returned by the lookup", () => {
    const lookup = () => 1.1;
    expect(convertAmountMinor(10_000, "USD", "EUR", lookup)).toBe(11_000);
  });

  it("degrades to the native-currency amount when no rate is known", () => {
    const lookup = () => null;
    expect(convertAmountMinor(10_000, "USD", "EUR", lookup)).toBe(10_000);
  });

  it("degrades to the native-currency amount when the rate is not finite", () => {
    const lookup = () => Number.NaN;
    expect(convertAmountMinor(10_000, "USD", "EUR", lookup)).toBe(10_000);
  });

  it("rounds to the nearest minor unit", () => {
    const lookup = () => 1 / 3;
    expect(convertAmountMinor(100, "USD", "EUR", lookup)).toBe(33);
  });
});

describe("buildFxLookup", () => {
  it("returns 1 for same-currency pairs even with no data", () => {
    const lookup = buildFxLookup({});
    expect(lookup("EUR", "EUR")).toBe(1);
  });

  it("returns the direct rate when present", () => {
    const lookup = buildFxLookup({ "USD:EUR": 0.9 });
    expect(lookup("USD", "EUR")).toBe(0.9);
  });

  it("falls back to the inverse rate when only that direction is cached", () => {
    const lookup = buildFxLookup({ "EUR:USD": 2 });
    expect(lookup("USD", "EUR")).toBe(0.5);
  });

  it("returns null when neither direction is known", () => {
    const lookup = buildFxLookup({ "GBP:USD": 1.3 });
    expect(lookup("USD", "EUR")).toBeNull();
  });
});
