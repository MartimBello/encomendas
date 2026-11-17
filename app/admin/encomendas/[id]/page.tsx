import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Mail, MapPin, Phone, Printer, Store } from "lucide-react";
import { getOrder } from "@/lib/data";
import { formatDateTime } from "@/lib/dates";
import { formatItemQuantity, formatProductName } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminOrderPage({ params }: PageProps<"/admin/encomendas/[id]">) {
  const { id } = await params;
  const result = await getOrder(id);
  if (!result?.order.revision) notFound();
  const { order, revisions } = result;
  const revision = order.revision;
  if (!revision) notFound();

  return <>
    <PageHeader title={order.order_number} description={`${order.campaign ? `${order.campaign.name} · ` : ""}Versão ${order.current_version} · criada ${formatDateTime(order.created_at)}`} actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/encomendas"><ArrowLeft data-icon="inline-start" />Encomendas</Link></Button>{order.status === "accepted" && <Button asChild><Link href={`/encomendas/${order.id}/imprimir`} target="_blank"><Printer data-icon="inline-start" />Imprimir</Link></Button>}</div>} />
    <div className="mb-5 flex flex-wrap items-center gap-2"><StatusBadge status={order.status} revised={order.current_version > 1} />{order.campaign && <Badge variant="secondary">Sazonal · {order.campaign.name}</Badge>}</div>
    <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <Card><CardHeader><CardTitle>Artigos</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{revision.items?.map((item) => <div key={item.id} className="flex justify-between gap-4 border-b pb-3 last:border-0"><div><p className="font-semibold">{formatProductName(item.product_name, item.variation_name)}</p>{item.item_note && <p className="text-sm text-muted-foreground">{item.item_note}</p>}</div><strong className="text-right">{formatItemQuantity(item)}</strong></div>)}{revision.general_notes && <div className="rounded-xl bg-muted p-4 text-sm"><strong>Observações:</strong><p className="mt-1 whitespace-pre-wrap">{revision.general_notes}</p></div>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Cliente e receção</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 text-sm"><p className="font-semibold">{revision.customer_name || "Dados anonimizados"}</p><p className="flex items-center gap-2 text-muted-foreground"><Mail />{revision.customer_email || "Não indicado"}</p><p className="flex items-center gap-2 text-muted-foreground"><Phone />{revision.customer_phone || "—"}</p><p className="flex items-center gap-2 text-muted-foreground"><CalendarClock />{revision.fulfillment_type === "delivery" ? "Entrega" : "Levantamento"}: {formatDateTime(revision.pickup_at)}</p><p className="flex items-center gap-2 text-muted-foreground"><MapPin />{revision.fulfillment_type === "delivery" ? revision.delivery_address : order.pickup_store?.name}</p><p className="flex items-center gap-2 text-muted-foreground"><Store />Origem: {order.ordering_store?.name}</p></CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{revisions.map((entry) => <Badge key={entry.id} variant={entry.id === order.current_revision_id ? "info" : "outline"}>Versão {entry.version} · {formatDateTime(entry.created_at)}</Badge>)}</CardContent></Card>
    </div>
  </>;
}
