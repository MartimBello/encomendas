import { getOrders } from "@/lib/data";
import { KitchenBoard } from "@/components/kitchen-board";
import { PageHeader } from "@/components/page-header";

export default async function SeasonalKitchenPage() {
  const orders = await getOrders({ kind: "seasonal", limit: 100 });
  return <><PageHeader title="Fila sazonal" description="Encomendas de campanhas especiais, separadas da fila diária." /><KitchenBoard initialOrders={orders} /></>;
}
