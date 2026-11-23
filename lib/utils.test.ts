import { describe, expect, it } from "vitest";
import type { OrderItem } from "@/lib/domain";
import { estimateLineTotalCents, orderRevenueEstimate, productPriceCents } from "@/lib/utils";

describe("revenue estimates", () => {
  it("uses quantity for standard and selection products", () => {
    expect(estimateLineTotalCents({ unit_price_cents: 1299, quantity_mode: "standard" }, 2.5)).toBe(3248);
    expect(estimateLineTotalCents({ unit_price_cents: 450, quantity_mode: "selection" }, 3)).toBe(1350);
  });

  it("uses the sum of individual weights for weighed products", () => {
    expect(estimateLineTotalCents({ unit_price_cents: 2500, quantity_mode: "unit_weight" }, 2, [2.2, 2.8])).toBe(12500);
  });

  it("uses the price for the selected product variation", () => {
    const product = {
      unit_price_cents: null,
      variation_prices_cents: { Pequeno: 999, Grande: 1399 },
      variations: ["Pequeno", "Grande"],
      quantity_mode: "selection" as const,
    };

    expect(productPriceCents(product, "Grande")).toBe(1399);
    expect(estimateLineTotalCents(product, 2, [], "Grande")).toBe(2798);
  });

  it("keeps missing prices distinguishable and marks mixed orders as partial", () => {
    expect(estimateLineTotalCents({ unit_price_cents: null, quantity_mode: "standard" }, 2)).toBeNull();
    const items = [
      { estimated_total_cents: 2598 },
      { estimated_total_cents: null },
    ] as OrderItem[];
    expect(orderRevenueEstimate(items)).toEqual({ totalCents: 2598, complete: false });
    expect(orderRevenueEstimate([{ estimated_total_cents: null } as OrderItem])).toBeNull();
  });
});
