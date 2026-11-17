import type { Order, OrderItem, OrderStatus } from "@/lib/domain";
import { statusLabels } from "@/lib/domain";
import { pickupSlotParts } from "@/lib/dates";
import { formatProductName, formatQuantity } from "@/lib/utils";

export type SeasonalExportReport = "orders" | "products";
export type SeasonalExportStatus = "accepted" | "all";
export type SeasonalExportStore = "none" | "ordering" | "pickup";

export type SeasonalExportOptions = {
  report: SeasonalExportReport;
  status: SeasonalExportStatus;
  groupByDate: boolean;
  store: SeasonalExportStore;
};

type ExportTable = {
  suffix: string;
  headers: string[];
  rows: string[][];
};

function selectedOrders(orders: Order[], status: SeasonalExportStatus) {
  return status === "accepted" ? orders.filter((order) => order.status === "accepted") : orders;
}

function storeName(order: Order, dimension: SeasonalExportStore) {
  if (dimension === "ordering") return order.ordering_store?.name ?? "Loja desconhecida";
  if (dimension === "pickup") return order.pickup_store?.name ?? "Sem levantamento em loja";
  return "";
}

function itemValues(item: OrderItem | undefined) {
  return {
    product: item ? formatProductName(item.product_name, item.variation_name) : "",
    quantity: item ? formatQuantity(item.quantity) : "",
    unit: item?.unit_label ?? "",
    totalWeight: item?.unit_weights?.length ? formatQuantity(item.unit_weights.reduce((sum, weight) => sum + Number(weight), 0)) : "",
    weightUnit: item?.unit_weights?.length ? item.unit_weight_label ?? "kg" : "",
    note: item?.item_note ?? "",
  };
}

function buildOrderRows(orders: Order[], status: SeasonalExportStatus): ExportTable {
  const rows = selectedOrders(orders, status).flatMap((order) => {
    const revision = order.revision;
    const items = revision?.items?.length ? revision.items : [undefined];
    return items.map((item) => {
      const values = itemValues(item);
      return [
        order.order_number,
        statusLabels[order.status as OrderStatus],
        order.campaign?.name ?? "",
        String(order.current_version),
        revision?.customer_name ?? "",
        revision?.customer_email ?? "",
        revision?.customer_phone ?? "",
        order.ordering_store?.name ?? "",
        order.pickup_store?.name ?? "",
        revision?.fulfillment_type === "delivery" ? "Entrega em casa" : "Levantamento em loja",
        revision?.delivery_address ?? "",
        revision ? pickupSlotParts(revision.pickup_at).date : "",
        revision ? pickupSlotParts(revision.pickup_at).time : "",
        values.product,
        values.quantity,
        values.unit,
        values.totalWeight,
        values.weightUnit,
        values.note,
        revision?.general_notes ?? "",
        order.rejection_reason ?? "",
        order.accepted_at ?? order.rejected_at ?? order.cancelled_at ?? "",
        order.created_at,
        order.updated_at,
      ];
    });
  });

  return {
    suffix: "encomendas",
    headers: ["Encomenda", "Estado", "Campanha", "Versão", "Cliente", "Email", "Telefone", "Loja de origem", "Loja de levantamento", "Modalidade", "Morada de entrega", "Data de receção", "Hora de receção", "Artigo", "Quantidade", "Unidade", "Peso total", "Unidade de peso", "Nota do artigo", "Observações gerais", "Motivo da rejeição", "Data do estado", "Criada em", "Atualizada em"],
    rows,
  };
}

function buildProductRows(orders: Order[], options: SeasonalExportOptions): ExportTable {
  const totals = new Map<string, { product: string; date: string; store: string; quantity: number; unit: string; totalWeight: number; weightUnit: string }>();

  for (const order of selectedOrders(orders, options.status)) {
    if (!order.revision) continue;
    const date = options.groupByDate ? pickupSlotParts(order.revision.pickup_at).date : "";
    const store = storeName(order, options.store);
    for (const item of order.revision.items ?? []) {
      const product = formatProductName(item.product_name, item.variation_name);
      const unit = item.unit_label ?? "";
      const weightUnit = item.unit_weights?.length ? item.unit_weight_label ?? "kg" : "";
      const key = JSON.stringify([product, unit, weightUnit, date, store]);
      const current = totals.get(key) ?? { product, date, store, quantity: 0, unit, totalWeight: 0, weightUnit };
      current.quantity += Number(item.quantity);
      current.totalWeight += item.unit_weights?.reduce((sum, weight) => sum + Number(weight), 0) ?? 0;
      totals.set(key, current);
    }
  }

  const headers = ["Artigo"];
  if (options.groupByDate) headers.push("Data de levantamento");
  if (options.store !== "none") headers.push(options.store === "ordering" ? "Loja de origem" : "Loja de levantamento");
  headers.push("Quantidade", "Unidade", "Peso total", "Unidade de peso");

  const values = [...totals.values()].sort((a, b) => a.product.localeCompare(b.product, "pt") || a.date.localeCompare(b.date) || a.store.localeCompare(b.store, "pt"));
  const rows = values.map((entry) => {
    const row = [entry.product];
    if (options.groupByDate) row.push(entry.date);
    if (options.store !== "none") row.push(entry.store);
    row.push(formatQuantity(entry.quantity), entry.unit, entry.totalWeight ? formatQuantity(entry.totalWeight) : "", entry.weightUnit);
    return row;
  });

  const dimensions = [options.groupByDate ? "data" : "", options.store === "ordering" ? "loja-origem" : options.store === "pickup" ? "loja-levantamento" : ""].filter(Boolean);
  return { suffix: `quantidades-por-artigo${dimensions.length ? `-por-${dimensions.join("-e-")}` : ""}`, headers, rows };
}

export function buildSeasonalExport(orders: Order[], options: SeasonalExportOptions) {
  return options.report === "orders" ? buildOrderRows(orders, options.status) : buildProductRows(orders, options);
}

function safeCsvCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function exportTableToCsv(table: Pick<ExportTable, "headers" | "rows">) {
  return `\uFEFF${[table.headers, ...table.rows].map((row) => row.map(safeCsvCell).join(";")).join("\r\n")}\r\n`;
}
