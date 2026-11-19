import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { OrderItem, ProductQuantityMode } from "@/lib/domain";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatQuantity(value: number | string) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 3 }).format(Number(value));
}

export function formatCurrency(cents: number | string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(cents) / 100);
}

export function estimateLineTotalCents(product: { unit_price_cents: number | null; quantity_mode: ProductQuantityMode }, quantity: number, unitWeights: number[] = []) {
  if (product.unit_price_cents === null) return null;
  const priceQuantity = product.quantity_mode === "unit_weight"
    ? unitWeights.reduce((total, weight) => total + Number(weight), 0)
    : quantity;
  return Math.round(product.unit_price_cents * priceQuantity);
}

export function orderRevenueEstimate(items: OrderItem[] | undefined) {
  const lines = items ?? [];
  const priced = lines.filter((item) => item.estimated_total_cents !== null && item.estimated_total_cents !== undefined);
  if (!priced.length) return null;
  return {
    totalCents: priced.reduce((total, item) => total + Number(item.estimated_total_cents), 0),
    complete: priced.length === lines.length,
  };
}

export function formatProductName(name: string | undefined, variation?: string) {
  return `${name || "Artigo"}${variation ? ` · ${variation}` : ""}`;
}

export function formatItemQuantity(item: { quantity: number | string; unit_label?: string; unit_weights?: number[]; unit_weight_label?: string }) {
  const quantity = `${formatQuantity(item.quantity)} ${item.unit_label || ""}`.trim();
  if (!item.unit_weights?.length) return quantity;
  const weightLabel = item.unit_weight_label || "kg";
  return `${quantity} · ${item.unit_weights.map((weight) => `${formatQuantity(weight)} ${weightLabel}`).join(", ")}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
