import Link from "next/link";
import { CalendarClock, Gift, Plus } from "lucide-react";
import { getOrders, getSeasonalCampaigns } from "@/lib/data";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { OrderCard } from "@/components/order-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function campaignAvailability(opensAt: string, closesAt: string) {
  const now = Date.now(); const opens = new Date(opensAt).getTime(); const closes = new Date(closesAt).getTime();
  return { available: now >= opens && now <= closes, upcoming: now < opens };
}

export default async function SeasonalOrdersPage() {
  const [campaigns, orders] = await Promise.all([getSeasonalCampaigns(), getOrders({ kind: "seasonal", limit: 100 })]);
  return <>
    <PageHeader title="Encomendas sazonais" description="Menus próprios para Natal, Páscoa e outras épocas, com dias especiais de levantamento." />
    <section className="mb-8 space-y-3"><h2 className="text-xl font-semibold">Campanhas</h2><div className="grid gap-4 lg:grid-cols-2">
      {campaigns.map((campaign) => {
        const { available, upcoming } = campaignAvailability(campaign.ordering_opens_at, campaign.ordering_closes_at);
        return <Card key={campaign.id} className={available ? "border-primary/40" : ""}><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary"><Gift className="text-primary" /></span><div><CardTitle>{campaign.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p></div></div><Badge variant={available ? "accepted" : upcoming ? "info" : "cancelled"}>{available ? "A aceitar" : upcoming ? "Brevemente" : "Encerrada"}</Badge></div></CardHeader><CardContent><p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" />Aceitação: {formatDateTime(campaign.ordering_opens_at)} – {formatDateTime(campaign.ordering_closes_at)}</p><p className="mt-2 text-sm">{campaign.products?.filter((product) => product.active).length ?? 0} artigos · {campaign.pickup_slots?.filter((slot) => slot.active).length ?? 0} horários de levantamento</p></CardContent><CardFooter>{available ? <Button asChild size="lg"><Link href={`/loja/sazonais/${campaign.id}`}><Plus />Registar encomenda</Link></Button> : <Button disabled variant="outline">Fora do período de aceitação</Button>}</CardFooter></Card>;
      })}
      {!campaigns.length && <Card><CardContent className="py-10 text-center text-muted-foreground">Não existem campanhas sazonais publicadas.</CardContent></Card>}
    </div></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Histórico sazonal</h2>{orders.length ? <div className="grid gap-4 xl:grid-cols-2">{orders.map((order) => <OrderCard key={order.id} order={order} href={`/loja/encomendas/${order.id}`} />)}</div> : <Card><CardContent className="py-10 text-center text-muted-foreground">Ainda não existem encomendas sazonais.</CardContent></Card>}</section>
  </>;
}
