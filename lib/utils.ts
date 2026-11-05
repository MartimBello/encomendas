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

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
