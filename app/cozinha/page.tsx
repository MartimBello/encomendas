import { getOrders } from "@/lib/data";
import { KitchenBoard } from "@/components/kitchen-board";
import { PageHeader } from "@/components/page-header";

export default async function KitchenPage() { const orders = await getOrders({ limit: 100 }); return <><PageHeader title="Cozinha" description="Aceite ou rejeite pedidos novos e reconheça cancelamentos com prioridade." /><KitchenBoard initialOrders={orders} /></>; }
