import { Suspense } from "react";
import { getOrders } from "@/lib/data";
import { OrdersDataTable } from "@/components/orders-data-table";
import { PageHeader } from "@/components/page-header";

async function AdminOrders({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const { estado, q } = await searchParams;
  const orders = await getOrders({ status: estado, search: q, limit: 250 });
  return <OrdersDataTable orders={orders} route="/admin/encomendas" detailRoute="/admin/encomendas" search={q} status={estado} emptyMessage="Ainda não existem encomendas." />;
}

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/encomendas">) {
  return <>
    <PageHeader title="Encomendas" description="Consulte todas as lojas e campanhas e pesquise pelo nome do cliente ou número da encomenda." />
    <Suspense fallback={<p>A carregar encomendas…</p>}><AdminOrders searchParams={searchParams} /></Suspense>
  </>;
}
