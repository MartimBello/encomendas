import type { ProductQuantityMode } from "@/lib/domain";
import { formatCurrency, getProductUnitPriceCents } from "@/lib/utils";

type PricedProduct = {
  unit_price_cents: number | null;
  variation_prices?: Record<string, number>;
  variations: string[];
  quantity_mode: ProductQuantityMode;
  unit_label: string;
  unit_weight_label: string;
};

export function ProductPriceList({ product }: { product: PricedProduct }) {
  const unit = product.quantity_mode === "unit_weight" ? product.unit_weight_label : product.quantity_mode === "selection" ? "seleção" : product.unit_label;

  if (!product.variations.length) {
    return product.unit_price_cents === null ? "Sem preço" : <><p className="font-medium">{formatCurrency(product.unit_price_cents)}</p><p className="text-xs text-muted-foreground">por {unit}</p></>;
  }

  return <div className="space-y-1">{product.variations.map((variation) => {
    const price = getProductUnitPriceCents(product, variation);
    return <p key={variation} className="text-sm"><span className="text-muted-foreground">{variation}:</span> <span className="font-medium">{price === null ? "Sem preço" : formatCurrency(price)}</span></p>;
  })}<p className="text-xs text-muted-foreground">por {unit}</p></div>;
}
