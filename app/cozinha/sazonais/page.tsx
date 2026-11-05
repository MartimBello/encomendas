import { getOrders } from "@/lib/data";
import { KitchenBoard } from "@/components/kitchen-board";
import { PageHeader } from "@/components/page-header";

export default async function SeasonalKitchenPage() {
  const orders = await getOrders({ kind: "seasonal", limit: 100 });
  return <><PageHeader title="Encomendas sazonais" description="Estas encomendas são confirmadas automaticamente; acompanhe aqui o histórico e eventuais cancelamentos." /><KitchenBoard initialOrders={orders} automaticAcceptance /></>;
}
