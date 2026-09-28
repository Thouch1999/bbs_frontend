import { describe, expect, it } from "vitest";

import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats USD with a $ sign and two decimals", () => {
    expect(formatMoney("12.50", "USD", "en")).toBe("$12.50");
  });

  it("formats KHR as a grouped whole number with the riel sign", () => {
    const result = formatMoney("41000", "KHR", "en");
    expect(result).toContain("41,000");
    expect(result).toContain("៛");
  });
});
