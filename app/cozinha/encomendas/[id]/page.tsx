import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { getOrder } from "@/lib/data";
import { formatDateTime } from "@/lib/dates";
import { formatQuantity } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function KitchenOrderPage({ params }: PageProps<"/cozinha/encomendas/[id]">) {
  const { id } = await params;
  const result = await getOrder(id);
  if (!result?.order.revision) notFound();
  const { order, revisions } = result;
  const revision = order.revision;
  if (!revision) notFound();

  return <>
    <PageHeader title={order.order_number} description={`${order.campaign ? `${order.campaign.name} · ` : ""}Versão ${order.current_version} · ${order.ordering_store?.name} → ${order.pickup_store?.name}`} actions={<div className="flex gap-2"><Button asChild variant="outline"><Link href={order.campaign ? "/cozinha/sazonais" : "/cozinha"}><ArrowLeft /> Fila</Link></Button>{order.status === "accepted" && <Button asChild><Link href={`/encomendas/${order.id}/imprimir`} target="_blank"><Printer /> Imprimir</Link></Button>}</div>} />
    <div className="mb-5"><StatusBadge status={order.status} revised={order.current_version > 1} /></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <Card><CardHeader><CardTitle>Artigos</CardTitle></CardHeader><CardContent className="space-y-3">{revision.items?.map((item) => <div key={item.id} className="flex justify-between gap-4 border-b pb-3"><div><p className="font-semibold">{item.product_name}</p><p className="text-sm text-muted-foreground">{item.item_note || "Sem observações"}</p></div><strong>{formatQuantity(item.quantity)} {item.unit_label}</strong></div>)}{revision.general_notes && <p className="rounded-xl bg-amber-50 p-3 text-sm"><strong>Observações gerais:</strong><br />{revision.general_notes}</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Cliente e levantamento</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p className="font-semibold">{revision.customer_name}</p><p>{revision.customer_email || "Dados removidos"}</p><p>{revision.customer_phone || "—"}</p><p className="pt-2"><strong>{formatDateTime(revision.pickup_at)}</strong></p><p>{order.pickup_store?.name} · {order.pickup_store?.address}</p><p className="text-muted-foreground">Encomenda registada em {order.ordering_store?.name}</p></CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Revisões</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{revisions.map((entry) => <span key={entry.id} className="rounded-lg border bg-muted px-3 py-2 text-sm">v{entry.version} · {formatDateTime(entry.created_at)}</span>)}</CardContent></Card>
    </div>
  </>;
}
