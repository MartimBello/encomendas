import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import type { Order } from "@/lib/domain";
import { formatDateTime } from "@/lib/dates";
import { formatCurrency, orderRevenueEstimate } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statuses = [["all", "Todas"], ["pending", "Por aceitar"], ["accepted", "Aceites"], ["rejected", "Rejeitadas"], ["cancelled", "Canceladas"]] as const;

function listHref(route: string, status: string, search?: string) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("estado", status);
  if (search) params.set("q", search);
  const query = params.toString();
  return query ? `${route}?${query}` : route;
}

export function OrdersDataTable({ orders, route, detailRoute, search, status, emptyMessage = "Sem encomendas neste estado" }: {
  orders: Order[];
  route: string;
  detailRoute: string;
  search?: string;
  status?: string;
  emptyMessage?: string;
}) {
  const activeStatus = statuses.some(([value]) => value === status) ? status! : "all";
  const revenueEstimates = orders.map((order) => orderRevenueEstimate(order.revision?.items));
  const knownRevenue = revenueEstimates.filter((estimate): estimate is NonNullable<typeof estimate> => estimate !== null);
  const totalRevenue = knownRevenue.length ? knownRevenue.reduce((total, estimate) => total + estimate.totalCents, 0) : null;
  const revenueComplete = knownRevenue.length === orders.length && knownRevenue.every((estimate) => estimate.complete);

  return <div className="flex flex-col gap-4">
    <form action={route} className="flex flex-col gap-2 sm:flex-row">
      <FieldGroup className="flex-1">
        <Field>
          <FieldLabel htmlFor={`${route}-order-search`} className="sr-only">Pesquisar encomendas</FieldLabel>
          <Input id={`${route}-order-search`} name="q" defaultValue={search} placeholder="Nome do cliente ou número da encomenda" />
        </Field>
      </FieldGroup>
      {activeStatus !== "all" && <input type="hidden" name="estado" value={activeStatus} />}
      <Button variant="outline"><Search data-icon="inline-start" />Pesquisar</Button>
      {search && <Button asChild variant="ghost"><Link href={listHref(route, activeStatus)}><X data-icon="inline-start" />Limpar</Link></Button>}
    </form>

    <div className="flex gap-2 overflow-x-auto pb-1">
      {statuses.map(([value, label]) => <Button key={value} asChild variant={activeStatus === value ? "default" : "outline"} size="sm"><Link href={listHref(route, value, search)}>{label}</Link></Button>)}
    </div>

    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Encomenda</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead>Receção</TableHead><TableHead>Loja</TableHead><TableHead>Estimativa</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
        <TableBody>
          {orders.map((order) => { const revenue = orderRevenueEstimate(order.revision?.items); return <TableRow key={order.id}>
            <TableCell className="font-mono text-xs font-semibold"><Link href={`${detailRoute}/${order.id}`} className="hover:underline">{order.order_number}</Link></TableCell>
            <TableCell className="font-medium">{order.revision?.customer_name || "Dados anonimizados"}</TableCell>
            <TableCell>{order.campaign ? <Badge variant="secondary">Sazonal · {order.campaign.name}</Badge> : <Badge variant="outline">Regular</Badge>}</TableCell>
            <TableCell>{order.revision ? <><p>{order.revision.fulfillment_type === "delivery" ? "Entrega" : "Levantamento"}</p><p className="text-xs text-muted-foreground">{formatDateTime(order.revision.pickup_at)}</p></> : "—"}</TableCell>
            <TableCell><p>{order.ordering_store?.name || "—"}</p>{order.revision?.fulfillment_type === "pickup" && order.pickup_store?.name && order.pickup_store.name !== order.ordering_store?.name && <p className="text-xs text-muted-foreground">Levantar: {order.pickup_store.name}</p>}</TableCell>
            <TableCell><p className="font-medium">{revenue ? formatCurrency(revenue.totalCents) : "—"}</p>{revenue && !revenue.complete && <p className="text-xs text-muted-foreground">Parcial</p>}</TableCell>
            <TableCell><StatusBadge status={order.status} revised={order.current_version > 1} /></TableCell>
            <TableCell className="text-right"><Button asChild variant="ghost" size="sm"><Link href={`${detailRoute}/${order.id}`}>Ver<ArrowRight data-icon="inline-end" /></Link></Button></TableCell>
          </TableRow>; })}
          {!orders.length && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">{search ? "Nenhuma encomenda corresponde à pesquisa." : emptyMessage}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
    <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><p>{orders.length} {orders.length === 1 ? "encomenda" : "encomendas"}</p><p>Receita estimada: <span className="font-medium text-foreground">{totalRevenue === null ? "Sem preços definidos" : `${formatCurrency(totalRevenue)}${revenueComplete ? "" : " · parcial"}`}</span></p></div>
  </div>;
}
