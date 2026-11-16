import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getOrders } from "@/lib/data";
import { OrdersDataTable } from "@/components/orders-data-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

async function Orders({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const { estado, q } = await searchParams;
  const orders = await getOrders({ status: estado, search: q, limit: 250 });
  return <OrdersDataTable orders={orders} route="/loja/encomendas" detailRoute="/loja/encomendas" search={q} status={estado} />;
}

export default function StoreOrdersPage({ searchParams }: PageProps<"/loja/encomendas">) {
  return <>
    <PageHeader title="Encomendas" description="Consulte encomendas regulares e sazonais, pesquise por cliente ou número e acompanhe o respetivo estado." actions={<Button asChild size="lg"><Link href="/loja/encomendas/nova"><Plus data-icon="inline-start" />Nova encomenda</Link></Button>} />
    <Suspense fallback={<p>A carregar encomendas…</p>}><Orders searchParams={searchParams} /></Suspense>
  </>;
}
