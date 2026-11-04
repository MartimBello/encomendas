import Link from "next/link";
import { Suspense } from "react";
import { Plus, Search } from "lucide-react";
import { getOrders } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { OrderCard } from "@/components/order-card";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";

async function Orders({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const { estado, q } = await searchParams; const orders = await getOrders({ status: estado, search: q });
  return <><form className="mb-4 flex gap-2" action="/loja/encomendas"><Input name="q" defaultValue={q} aria-label="Pesquisar por número" placeholder="Pesquisar por número da encomenda" />{estado && estado !== "all" && <input type="hidden" name="estado" value={estado} />}<Button variant="outline"><Search /> Pesquisar</Button></form><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{[["all", "Todas"], ["pending", "Por aceitar"], ["accepted", "Aceites"], ["rejected", "Rejeitadas"], ["cancelled", "Canceladas"]].map(([value, label]) => <Button key={value} asChild variant={(estado || "all") === value ? "default" : "outline"} size="sm"><Link href={`${value === "all" ? "/loja/encomendas" : `/loja/encomendas?estado=${value}`}${q ? `${value === "all" ? "?" : "&"}q=${encodeURIComponent(q)}` : ""}`}>{label}</Link></Button>)}</div>{orders.length ? <div className="grid gap-4 xl:grid-cols-2">{orders.map((order) => <OrderCard key={order.id} order={order} href={`/loja/encomendas/${order.id}`} />)}</div> : <EmptyState title="Sem encomendas neste estado" description="Quando existirem encomendas, aparecerão aqui em tempo real após atualizar a página." action={<Button asChild><Link href="/loja/encomendas/nova"><Plus /> Nova encomenda</Link></Button>} />}</>;
}

export default function StoreOrdersPage({ searchParams }: PageProps<"/loja/encomendas">) { return <><PageHeader title="Encomendas" description="Consulte o estado, reveja detalhes ou envie uma alteração à cozinha." actions={<Button asChild size="lg"><Link href="/loja/encomendas/nova"><Plus /> Nova encomenda</Link></Button>} /><Suspense fallback={<p>A carregar encomendas…</p>}><Orders searchParams={searchParams} /></Suspense></>; }
