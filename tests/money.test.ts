import { formatMoney, formatMoneySigned, formatPercentage, toMajorUnits, toMinorUnits } from "@/utils/money";

describe("minor unit conversion", () => {
  it("converts major to minor units", () => {
    expect(toMinorUnits(10.25)).toBe(1025);
  });

  it("converts minor to major units", () => {
    expect(toMajorUnits(1025)).toBe(10.25);
  });

  it("rounds fractional cents when converting to minor units", () => {
    expect(toMinorUnits(10.255)).toBe(1026);
  });
});

describe("formatMoney", () => {
  it("formats using Dutch thousands and decimal separators", () => {
    expect(formatMoney(18425040)).toBe("€ 184.250,40");
  });

  it("formats zero correctly", () => {
    expect(formatMoney(0)).toBe("€ 0,00");
  });

  it("shows a minus sign for negative amounts", () => {
    expect(formatMoney(-1050)).toBe("-€ 10,50");
  });

  it("can hide the sign", () => {
    expect(formatMoney(-1050, "EUR", { hideSign: true })).toBe("€ 10,50");
  });
});

describe("formatMoneySigned", () => {
  it("prefixes positive amounts with a plus sign", () => {
    expect(formatMoneySigned(245050)).toBe("+€ 2.450,50");
  });

  it("prefixes negative amounts with a minus sign", () => {
    expect(formatMoneySigned(-42000)).toBe("-€ 420,00");
  });

  it("shows neither sign for zero", () => {
    expect(formatMoneySigned(0)).toBe("€ 0,00");
  });
});

describe("formatPercentage", () => {
  it("formats a positive fraction with one decimal", () => {
    expect(formatPercentage(0.084)).toBe("8,4%");
  });

  it("formats a signed positive fraction with a plus sign", () => {
    expect(formatPercentage(0.084, { signed: true })).toBe("+8,4%");
  });

  it("formats a negative fraction with a minus sign", () => {
    expect(formatPercentage(-0.021, { signed: true })).toBe("-2,1%");
  });
});
