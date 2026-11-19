import { z } from "zod";
import type { Order, OrderItem, SeasonalCampaign } from "@/lib/domain";
import { formatDate, formatDateTime, pickupSlotParts } from "@/lib/dates";
import { formatProductName, formatQuantity } from "@/lib/utils";

export const reportModes = ["order_sheets", "product_totals"] as const;
export type SeasonalReportMode = (typeof reportModes)[number];
export type SeasonalProductAggregation = "sum" | "order_list";

export type SeasonalReportDefinition = {
  version: 3;
  mode: SeasonalReportMode;
  separateByDay: boolean;
  productIds: string[];
  productAggregation: SeasonalProductAggregation;
};

export type SeasonalOrderSheetItem = {
  id: string;
  product: string;
  quantity: string;
  totalWeight: string;
};

export type SeasonalOrderSheet = {
  id: string;
  orderNumber: string;
  version: number;
  orderingStore: string;
  fulfillmentLabel: string;
  serviceDate: string;
  serviceTime: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  items: SeasonalOrderSheetItem[];
};

export type SeasonalProductTotalRow = {
  id: string;
  product: string;
  quantity: string;
  orderQuantities: { orderId: string; clientName: string; quantity: string }[];
};

export type SeasonalProductTotalSection = {
  key: string;
  title: string | null;
  rows: SeasonalProductTotalRow[];
  continued?: boolean;
};

export type SeasonalReportView = {
  mode: SeasonalReportMode;
  productAggregation: SeasonalProductAggregation;
  title: string;
  campaignName: string;
  generatedAt: string;
  summary: string;
  rowCount: number;
  orderSheets: SeasonalOrderSheet[];
  productSections: SeasonalProductTotalSection[];
};

export type SeasonalReportPreview = SeasonalReportView & {
  page: number;
  pageCount: number;
};

export const seasonalReportDefinitionSchema = z.object({
  version: z.literal(3),
  mode: z.enum(reportModes),
  separateByDay: z.boolean(),
  productIds: z.array(z.uuid()),
  productAggregation: z.enum(["sum", "order_list"]),
}).superRefine((definition, context) => {
  if (new Set(definition.productIds).size !== definition.productIds.length) {
    context.addIssue({ code: "custom", path: ["productIds"], message: "Os artigos não podem repetir-se." });
  }
  if (definition.mode === "order_sheets" && (definition.separateByDay || definition.productIds.length || definition.productAggregation !== "sum")) {
    context.addIssue({ code: "custom", message: "As opções de artigo e dia aplicam-se apenas aos totais por artigo." });
  }
});

export const seasonalReportPreviewRequestSchema = z.object({
  definition: seasonalReportDefinitionSchema,
  page: z.number().int().positive().default(1),
});

export function defaultSeasonalReportDefinition(preset?: string): SeasonalReportDefinition {
  const totals = preset === "product-totals" || preset === "product-totals-day";
  return {
    version: 3,
    mode: totals ? "product_totals" : "order_sheets",
    separateByDay: preset === "product-totals-day",
    productIds: [],
    productAggregation: "sum",
  };
}

function totalWeight(item: OrderItem) {
  return item.unit_weights?.reduce((sum, value) => sum + Number(value), 0) ?? 0;
}

function productName(item: OrderItem) {
  return formatProductName(item.product_name, item.variation_name);
}

function quantityLabel(item: OrderItem) {
  return `${formatQuantity(item.quantity)} ${item.unit_label?.trim() || "un."}`;
}

function weightLabel(item: OrderItem, weight = totalWeight(item)) {
  return weight ? `${formatQuantity(weight)} ${item.unit_weight_label?.trim() || "kg"}` : "";
}

function fulfillmentLabel(order: Order) {
  return order.revision?.fulfillment_type === "delivery" ? "Entrega em casa" : "Levantamento em loja";
}

function acceptedOrders(orders: Order[]) {
  return orders
    .filter((order) => order.status === "accepted" && order.revision)
    .sort((left, right) => {
      const byService = left.revision!.pickup_at.localeCompare(right.revision!.pickup_at);
      return byService || left.order_number.localeCompare(right.order_number, "pt", { numeric: true });
    });
}

function buildOrderSheets(orders: Order[]): SeasonalOrderSheet[] {
  return orders.map((order) => {
    const revision = order.revision!;
    const service = pickupSlotParts(revision.pickup_at);
    return {
      id: order.id,
      orderNumber: order.order_number,
      version: order.current_version,
      orderingStore: order.ordering_store?.name ?? "Loja desconhecida",
      fulfillmentLabel: fulfillmentLabel(order),
      serviceDate: formatDate(`${service.date}T12:00:00Z`),
      serviceTime: service.time,
      customerName: revision.customer_name ?? "Dados anonimizados",
      customerPhone: revision.customer_phone ?? "Não indicado",
      deliveryAddress: revision.fulfillment_type === "delivery" ? revision.delivery_address ?? "Não indicada" : null,
      items: (revision.items ?? []).map((item, index) => ({
        id: item.id ?? `${order.id}:${index}`,
        product: productName(item),
        quantity: quantityLabel(item),
        totalWeight: weightLabel(item),
      })),
    };
  });
}

function buildProductSections(orders: Order[], definition: SeasonalReportDefinition): SeasonalProductTotalSection[] {
  const selected = new Set(definition.productIds);
  const grouped = new Map<string, { order: Order; item: OrderItem }[]>();

  for (const order of orders) {
    const serviceDate = pickupSlotParts(order.revision!.pickup_at).date;
    for (const item of order.revision!.items ?? []) {
      if (selected.size && (!item.seasonal_product_id || !selected.has(item.seasonal_product_id))) continue;
      const key = definition.separateByDay ? serviceDate : "all";
      grouped.set(key, [...(grouped.get(key) ?? []), { order, item }]);
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, lines]) => {
      const totals = new Map<string, {
        product: string;
        quantity: number;
        unit: string;
        orders: Map<string, { clientName: string; quantity: number }>;
      }>();
      for (const { order, item } of lines) {
        const name = productName(item);
        const unit = item.unit_label?.trim() || "un.";
        const totalKey = JSON.stringify([item.seasonal_product_id ?? name, name, unit]);
        const total = totals.get(totalKey) ?? { product: name, quantity: 0, unit, orders: new Map() };
        total.quantity += Number(item.quantity);
        const perOrder = total.orders.get(order.id) ?? {
          clientName: order.revision?.customer_name ?? "Dados anonimizados",
          quantity: 0,
        };
        perOrder.quantity += Number(item.quantity);
        total.orders.set(order.id, perOrder);
        totals.set(totalKey, total);
      }
      const rows = [...totals.entries()]
        .map(([id, total]) => ({
          id,
          product: total.product,
          quantity: `${formatQuantity(total.quantity)} ${total.unit}`,
          orderQuantities: [...total.orders].map(([orderId, entry]) => ({
            orderId,
            clientName: entry.clientName,
            quantity: `${formatQuantity(entry.quantity)} ${total.unit}`,
          })),
        }))
        .sort((left, right) => left.product.localeCompare(right.product, "pt", { numeric: true }));
      return {
        key,
        title: definition.separateByDay ? formatDate(`${key}T12:00:00Z`) : null,
        rows,
      };
    });
}

export function buildSeasonalReport(
  campaign: Pick<SeasonalCampaign, "name">,
  orders: Order[],
  definition: SeasonalReportDefinition,
  generatedAt = new Date().toISOString(),
): SeasonalReportView {
  const parsed = seasonalReportDefinitionSchema.parse(definition);
  const accepted = acceptedOrders(orders);
  const orderSheets = parsed.mode === "order_sheets" ? buildOrderSheets(accepted) : [];
  const productSections = parsed.mode === "product_totals" ? buildProductSections(accepted, parsed) : [];
  const rowCount = parsed.mode === "order_sheets"
    ? orderSheets.length
    : productSections.reduce((total, section) => total + section.rows.length, 0);

  return {
    mode: parsed.mode,
    productAggregation: parsed.productAggregation,
    title: parsed.mode === "order_sheets"
      ? `Folhas de encomenda - ${campaign.name}`
      : `${parsed.productAggregation === "sum" ? "Totais por artigo" : "Artigos por encomenda"} - ${campaign.name}`,
    campaignName: campaign.name,
    generatedAt,
    summary: parsed.mode === "order_sheets"
      ? `${orderSheets.length} ${orderSheets.length === 1 ? "encomenda aceite" : "encomendas aceites"}`
      : `${rowCount} ${rowCount === 1 ? "artigo" : "artigos"}${parsed.productAggregation === "sum" ? " com quantidades somadas" : " por encomenda"}${parsed.separateByDay ? " e por dia" : ""}`,
    rowCount,
    orderSheets,
    productSections,
  };
}

export function paginateSeasonalReport(report: SeasonalReportView, requestedPage: number): SeasonalReportPreview {
  if (report.mode === "order_sheets") {
    const pageCount = Math.max(1, report.orderSheets.length);
    const page = Math.min(Math.max(1, requestedPage), pageCount);
    return { ...report, orderSheets: report.orderSheets.slice(page - 1, page), page, pageCount };
  }

  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(report.rowCount / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  let cursor = 0;
  const productSections: SeasonalProductTotalSection[] = [];
  for (const section of report.productSections) {
    const sectionStart = cursor;
    const sectionEnd = cursor + section.rows.length;
    cursor = sectionEnd;
    if (sectionEnd <= start || sectionStart >= end) continue;
    const localStart = Math.max(0, start - sectionStart);
    const localEnd = Math.min(section.rows.length, end - sectionStart);
    productSections.push({
      ...section,
      rows: section.rows.slice(localStart, localEnd),
      continued: localStart > 0,
    });
  }
  return { ...report, productSections, page, pageCount };
}

export function reportGeneratedLabel(value: string) {
  return formatDateTime(value);
}
