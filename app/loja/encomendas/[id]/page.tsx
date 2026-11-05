import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Mail, MapPin, Phone, Printer, Store } from "lucide-react";
import { getOrder } from "@/lib/data";
import { formatDateTime } from "@/lib/dates";
import { formatProductName, formatQuantity } from "@/lib/utils";
import { StoreOrderActions } from "@/components/order-actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OrderDetailPage({ params }: PageProps<"/loja/encomendas/[id]">) {
  const { id } = await params;
  const result = await getOrder(id);
  if (!result?.order.revision) notFound();
  const { order, revisions } = result;
  const revision = order.revision;
  if (!revision) notFound();

  return <>
    <PageHeader
      title={order.order_number}
      description={`${order.campaign ? `${order.campaign.name} · ` : ""}Versão ${order.current_version} · criada ${formatDateTime(order.created_at)}`}
      actions={<StoreOrderActions order={order} />}
    />
    <div className="mb-5">
      <StatusBadge status={order.status} revised={order.current_version > 1} />
      {order.rejection_reason && <p className="mt-2 text-sm text-destructive">Motivo: {order.rejection_reason}</p>}
    </div>

    <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <Card>
        <CardHeader><CardTitle>Artigos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {revision.items?.map((item) => <div key={item.id} className="flex justify-between gap-4 border-b pb-3 last:border-0">
            <div><p className="font-semibold">{formatProductName(item.product_name, item.variation_name)}</p>{item.item_note && <p className="text-sm text-muted-foreground">{item.item_note}</p>}</div>
            <p className="font-semibold">{formatQuantity(item.quantity)} {item.unit_label}</p>
          </div>)}
          {revision.general_notes && <div className="rounded-xl bg-muted p-4 text-sm"><strong>Observações:</strong><p className="mt-1 whitespace-pre-wrap">{revision.general_notes}</p></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cliente e levantamento</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="font-semibold">{revision.customer_name}</p>
          <p className="flex items-center gap-2 text-muted-foreground"><Mail className="size-4" />{revision.customer_email || "Dados removidos"}</p>
          <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-4" />{revision.customer_phone || "—"}</p>
          <p className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-4" />{formatDateTime(revision.pickup_at)}</p>
          <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4" />{order.pickup_store?.name}</p>
          <p className="flex items-center gap-2 text-muted-foreground"><Store className="size-4" />Origem: {order.ordering_store?.name}</p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Histórico e comparação de versões</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {revisions.map((entry) => {
            const current = entry.id === order.current_revision_id;
            return <article key={entry.id} className="rounded-xl border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="font-semibold">Versão {entry.version}</p><p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p></div>
                <Badge variant={current ? "info" : "outline"}>{current ? "Atual" : "Substituída"}</Badge>
              </div>
              <dl className="grid gap-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Cliente</dt><dd>{entry.customer_name || "Dados removidos"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Levantamento</dt><dd>{formatDateTime(entry.pickup_at)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Artigos</dt><dd>{entry.items?.map((item) => `${formatQuantity(item.quantity)} ${item.unit_label} ${formatProductName(item.product_name, item.variation_name)}`).join(" · ")}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Observações</dt><dd>{entry.general_notes || "—"}</dd></div>
              </dl>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href={`/encomendas/${order.id}/imprimir?versao=${entry.version}`} target="_blank"><Printer /> Imprimir esta versão</Link>
              </Button>
            </article>;
          })}
        </CardContent>
      </Card>
    </div>
  </>;
}
