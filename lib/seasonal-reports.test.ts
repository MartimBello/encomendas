// @vitest-environment node

import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { FulfillmentType, Order, OrderStatus, SeasonalCampaign } from "@/lib/domain";
import { renderSeasonalReportPdf } from "@/lib/seasonal-report-pdf";
import {
  buildSeasonalReport,
  defaultSeasonalReportDefinition,
  paginateSeasonalReport,
  seasonalReportDefinitionSchema,
} from "@/lib/seasonal-reports";

const ids = {
  campaign: "40000000-0000-4000-8000-000000000001",
  origin: "10000000-0000-4000-8000-000000000001",
  pickup: "10000000-0000-4000-8000-000000000002",
  pickupSecond: "10000000-0000-4000-8000-000000000003",
  turkey: "50000000-0000-4000-8000-000000000001",
  cod: "50000000-0000-4000-8000-000000000002",
};

const campaign = { id: ids.campaign, name: "Natal - demonstração", slug: "natal" } as SeasonalCampaign;

function order(options: {
  id?: string;
  number?: string;
  status?: OrderStatus;
  fulfillment?: FulfillmentType;
  date?: string;
  productId?: string | null;
  productName?: string;
  variation?: string;
  quantity?: number;
  unit?: string;
  weights?: number[];
  address?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  pickupStoreId?: string;
  pickupStoreName?: string;
} = {}): Order {
  const id = options.id ?? "70000000-0000-4000-8000-000000000001";
  const fulfillment = options.fulfillment ?? "pickup";
  const pickupStoreId = options.pickupStoreId ?? ids.pickup;
  const pickupStoreName = options.pickupStoreName ?? "Matosinhos";
  return {
    id,
    order_number: options.number ?? "SAZ-001",
    campaign_id: ids.campaign,
    ordering_store_id: ids.origin,
    pickup_store_id: fulfillment === "pickup" ? pickupStoreId : null,
    status: options.status ?? "accepted",
    current_version: 2,
    current_revision_id: "80000000-0000-4000-8000-000000000001",
    accepted_revision_id: "80000000-0000-4000-8000-000000000001",
    accepted_at: "2026-12-20T10:00:00Z",
    rejected_at: null,
    cancelled_at: null,
    rejection_reason: null,
    cancellation_requires_ack: false,
    cancellation_acknowledged_at: null,
    created_at: "2026-12-19T10:00:00Z",
    updated_at: "2026-12-20T10:00:00Z",
    ordering_store: { id: ids.origin, name: "Boavista", address: "" },
    pickup_store: fulfillment === "pickup" ? { id: pickupStoreId, name: pickupStoreName, address: "" } : null,
    campaign: { id: ids.campaign, name: campaign.name, slug: campaign.slug },
    revision: {
      id: "80000000-0000-4000-8000-000000000001",
      order_id: id,
      version: 2,
      customer_name: options.customerName === undefined ? "Joana Coração" : options.customerName,
      customer_email: "joana@example.pt",
      customer_phone: options.customerPhone === undefined ? "912345678" : options.customerPhone,
      pickup_store_id: fulfillment === "pickup" ? pickupStoreId : null,
      pickup_at: options.date ?? "2026-12-24T10:00:00Z",
      fulfillment_type: fulfillment,
      delivery_address: fulfillment === "delivery" ? options.address ?? "Rua das Flores, Porto" : null,
      general_notes: "",
      created_at: "2026-12-19T10:00:00Z",
      anonymized_at: null,
      items: [{
        id: `${id}-item`,
        product_id: null,
        seasonal_product_id: options.productId === undefined ? ids.turkey : options.productId,
        product_name: options.productName ?? "Peru",
        variation_name: options.variation ?? "Recheado",
        quantity: options.quantity ?? 2,
        unit_label: options.unit ?? "un.",
        unit_weights: options.weights ?? [3.2, 3.5],
        unit_weight_label: "kg",
      }],
    },
  };
}

describe("seasonal export definition", () => {
  it("has only the two focused export modes", () => {
    expect(defaultSeasonalReportDefinition()).toEqual({ version: 4, mode: "order_sheets", separateByDay: false, separateByServiceLocation: false, productIds: [], productAggregation: "sum" });
    expect(defaultSeasonalReportDefinition("product-totals-day")).toEqual({ version: 4, mode: "product_totals", separateByDay: true, separateByServiceLocation: false, productIds: [], productAggregation: "sum" });
    expect(seasonalReportDefinitionSchema.safeParse(defaultSeasonalReportDefinition()).success).toBe(true);
  });

  it("rejects duplicate products and product options on order sheets", () => {
    expect(seasonalReportDefinitionSchema.safeParse({ version: 4, mode: "product_totals", separateByDay: false, separateByServiceLocation: false, productIds: [ids.turkey, ids.turkey], productAggregation: "sum" }).success).toBe(false);
    expect(seasonalReportDefinitionSchema.safeParse({ version: 4, mode: "order_sheets", separateByDay: true, separateByServiceLocation: false, productIds: [], productAggregation: "sum" }).success).toBe(false);
    expect(seasonalReportDefinitionSchema.safeParse({ version: 4, mode: "order_sheets", separateByDay: false, separateByServiceLocation: true, productIds: [], productAggregation: "sum" }).success).toBe(false);
  });
});

describe("seasonal export building", () => {
  it("creates one operational sheet per accepted order with the required customer and service information", () => {
    const pickup = order();
    const delivery = order({
      id: "70000000-0000-4000-8000-000000000002",
      number: "SAZ-002",
      fulfillment: "delivery",
      address: "Avenida Central, Braga",
    });
    const rejected = order({ id: "70000000-0000-4000-8000-000000000003", number: "SAZ-003", status: "rejected" });
    const report = buildSeasonalReport(campaign, [delivery, rejected, pickup], defaultSeasonalReportDefinition());

    expect(report.orderSheets).toHaveLength(2);
    expect(report.orderSheets[0]).toMatchObject({
      orderNumber: "SAZ-001",
      fulfillmentLabel: "Levantamento em loja",
      serviceDate: "24/12/2026",
      serviceTime: "10:00",
      customerName: "Joana Coração",
      customerPhone: "912345678",
      deliveryAddress: null,
    });
    expect(report.orderSheets[1].deliveryAddress).toBe("Avenida Central, Braga");
    expect(report.orderSheets[0].items[0]).toMatchObject({ product: "Peru · Recheado", quantity: "2 un.", totalWeight: "6,7 kg" });
  });

  it("totals products, optionally separates days, and includes only selected products", () => {
    const turkey = order();
    const moreTurkey = order({ id: "70000000-0000-4000-8000-000000000004", number: "SAZ-004", quantity: 1, weights: [4] });
    const cod = order({ id: "70000000-0000-4000-8000-000000000005", number: "SAZ-005", productId: ids.cod, productName: "Bacalhau", variation: "Posta", quantity: 3, weights: [] });
    const laterTurkey = order({ id: "70000000-0000-4000-8000-000000000006", number: "SAZ-006", date: "2026-12-25T12:00:00Z" });
    const definition = { ...defaultSeasonalReportDefinition("product-totals-day"), productIds: [ids.turkey] };
    const report = buildSeasonalReport(campaign, [turkey, moreTurkey, cod, laterTurkey], definition);

    expect(report.productSections).toHaveLength(2);
    expect(report.productSections.map((section) => section.title)).toEqual(["24/12/2026", "25/12/2026"]);
    expect(report.productSections[0].rows[0]).toMatchObject({ product: "Peru · Recheado", quantity: "3 un." });
    expect(report.productSections[0].rows[0].orderQuantities).toHaveLength(2);
    expect(report.productSections.flatMap((section) => section.rows).some((row) => row.product.includes("Bacalhau"))).toBe(false);
  });

  it("lists the quantity from each order with the customer name when sums are disabled", () => {
    const second = order({
      id: "70000000-0000-4000-8000-000000000008",
      number: "SAZ-008",
      customerName: "Manuel Silva",
      quantity: 1,
    });
    const definition = { ...defaultSeasonalReportDefinition("product-totals"), productAggregation: "order_list" as const };
    const report = buildSeasonalReport(campaign, [order(), second], definition);

    expect(report.productSections[0].rows[0]).toMatchObject({
      product: "Peru · Recheado",
      orderQuantities: [
        { clientName: "Joana Coração", quantity: "2 un." },
        { clientName: "Manuel Silva", quantity: "1 un." },
      ],
    });
  });

  it("separates product totals by pickup store and home delivery", () => {
    const secondStore = order({
      id: "70000000-0000-4000-8000-000000000009",
      number: "SAZ-009",
      pickupStoreId: ids.pickupSecond,
      pickupStoreName: "Gaia",
      quantity: 3,
    });
    const delivery = order({
      id: "70000000-0000-4000-8000-000000000010",
      number: "SAZ-010",
      fulfillment: "delivery",
      quantity: 1,
    });
    const definition = { ...defaultSeasonalReportDefinition("product-totals"), separateByServiceLocation: true };
    const report = buildSeasonalReport(campaign, [order(), secondStore, delivery], definition);

    expect(report.productSections.map((section) => ({ title: section.title, quantity: section.rows[0].quantity }))).toEqual([
      { title: "Entrega ao domicílio", quantity: "1 un." },
      { title: "Levantamento em Gaia", quantity: "3 un." },
      { title: "Levantamento em Matosinhos", quantity: "2 un." },
    ]);
    expect(report.summary).toContain("por local de serviço");
  });

  it("keeps snapshotted product names when a product reference was removed and handles anonymized clients", () => {
    const legacy = order({ productId: null, productName: "Artigo removido", variation: "", customerName: null, customerPhone: null });
    const sheets = buildSeasonalReport(campaign, [legacy], defaultSeasonalReportDefinition());
    const totals = buildSeasonalReport(campaign, [legacy], defaultSeasonalReportDefinition("product-totals"));
    expect(sheets.orderSheets[0]).toMatchObject({ customerName: "Dados anonimizados", customerPhone: "Não indicado" });
    expect(totals.productSections[0].rows[0].product).toBe("Artigo removido");
  });

  it("paginates order sheets one order at a time and returns useful empty reports", () => {
    const orders = Array.from({ length: 3 }, (_, index) => order({
      id: `70000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      number: `SAZ-${index + 10}`,
    }));
    const report = buildSeasonalReport(campaign, orders, defaultSeasonalReportDefinition());
    expect(paginateSeasonalReport(report, 2).orderSheets[0].orderNumber).toBe("SAZ-11");
    expect(paginateSeasonalReport(report, 2).pageCount).toBe(3);
    expect(buildSeasonalReport(campaign, [], defaultSeasonalReportDefinition()).rowCount).toBe(0);
  });
});

describe("seasonal export PDF", () => {
  it("renders order sheets plus summed and per-order product reports as valid Unicode PDFs", async () => {
    const orders = [
      order(),
      order({ id: "70000000-0000-4000-8000-000000000007", number: "SAZ-007", fulfillment: "delivery", date: "2026-12-25T12:30:00Z", customerName: "Manuel Silva" }),
    ];
    const sheets = buildSeasonalReport(campaign, orders, defaultSeasonalReportDefinition(), "2026-12-21T12:00:00Z");
    const totalsDefinition = { ...defaultSeasonalReportDefinition("product-totals-day"), separateByServiceLocation: true };
    const totals = buildSeasonalReport(campaign, orders, totalsDefinition, "2026-12-21T12:00:00Z");
    expect(totals.productSections.map((section) => section.title)).toEqual([
      "24/12/2026 · Levantamento em Matosinhos",
      "25/12/2026 · Entrega ao domicílio",
    ]);
    const listDefinition = { ...defaultSeasonalReportDefinition("product-totals"), productAggregation: "order_list" as const };
    const list = buildSeasonalReport(campaign, orders, listDefinition, "2026-12-21T12:00:00Z");
    const [sheetsPdf, totalsPdf, listPdf] = await Promise.all([renderSeasonalReportPdf(sheets), renderSeasonalReportPdf(totals), renderSeasonalReportPdf(list)]);
    for (const pdf of [sheetsPdf, totalsPdf, listPdf]) {
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(10_000);
    }
    if (process.env.ORDER_SHEETS_PDF_OUTPUT) await writeFile(process.env.ORDER_SHEETS_PDF_OUTPUT, sheetsPdf);
    if (process.env.PRODUCT_TOTALS_PDF_OUTPUT) await writeFile(process.env.PRODUCT_TOTALS_PDF_OUTPUT, totalsPdf);
    if (process.env.PRODUCT_LIST_PDF_OUTPUT) await writeFile(process.env.PRODUCT_LIST_PDF_OUTPUT, listPdf);
  });
});
