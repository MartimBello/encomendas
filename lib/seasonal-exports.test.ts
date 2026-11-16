import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/domain";
import { buildSeasonalExport, exportTableToCsv } from "@/lib/seasonal-exports";

const orders = [
  {
    id: "order-1",
    order_number: "SAZ-001",
    campaign_id: "campaign-1",
    ordering_store_id: "store-1",
    pickup_store_id: "store-2",
    status: "accepted",
    created_at: "2026-12-20T10:00:00Z",
    updated_at: "2026-12-20T10:00:00Z",
    ordering_store: { id: "store-1", name: "Boavista", address: "" },
    pickup_store: { id: "store-2", name: "Matosinhos", address: "" },
    campaign: { id: "campaign-1", name: "Natal", slug: "natal" },
    revision: {
      id: "revision-1",
      order_id: "order-1",
      version: 1,
      customer_name: "Cliente Teste",
      customer_email: "teste@example.pt",
      customer_phone: "912345678",
      pickup_store_id: "store-2",
      pickup_at: "2026-12-24T10:00:00Z",
      general_notes: "",
      created_at: "2026-12-20T10:00:00Z",
      anonymized_at: null,
      items: [{ product_name: "Peru", variation_name: "Recheado", product_id: null, quantity: 2, unit_label: "un.", unit_weights: [3.2, 3.5], unit_weight_label: "kg" }],
    },
  },
] as Order[];

describe("seasonal exports", () => {
  it("groups product quantities by pickup date and store", () => {
    const table = buildSeasonalExport([...orders, { ...orders[0], id: "order-2", order_number: "SAZ-002" }], {
      report: "products",
      status: "accepted",
      groupByDate: true,
      store: "ordering",
    });

    expect(table.headers).toEqual(["Artigo", "Data de levantamento", "Loja de origem", "Quantidade", "Unidade", "Peso total", "Unidade de peso"]);
    expect(table.rows).toEqual([["Peru · Recheado", "2026-12-24", "Boavista", "4", "un.", "13,4", "kg"]]);
  });

  it("exports every order line and protects spreadsheet formulas", () => {
    const table = buildSeasonalExport(orders, { report: "orders", status: "all", groupByDate: false, store: "none" });
    table.rows[0][3] = "=SUM(A1:A2)";
    const csv = exportTableToCsv(table);

    expect(csv).toContain('"SAZ-001"');
    expect(csv).toContain('"\'=SUM(A1:A2)"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
