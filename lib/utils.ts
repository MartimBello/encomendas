import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatQuantity(value: number | string) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 3 }).format(Number(value));
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
