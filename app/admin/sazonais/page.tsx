import { CalendarClock, Gift, MapPin, Utensils } from "lucide-react";
import { getSeasonalCampaigns } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { Location } from "@/lib/domain";
import { formatQuantity } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SeasonalCampaignForm, SeasonalPickupSlotForm, SeasonalProductForm, SeasonalToggleButton } from "@/components/seasonal-admin-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function periodState(opens: string, closes: string) {
  const now = Date.now();
  if (now < new Date(opens).getTime()) return { label: "Agendada", variant: "info" as const };
  if (now > new Date(closes).getTime()) return { label: "Encerrada", variant: "cancelled" as const };
  return { label: "A aceitar", variant: "accepted" as const };
}

export default async function SeasonalAdminPage() {
  const supabase = await createClient();
  const [campaigns, { data: locations }] = await Promise.all([
    getSeasonalCampaigns(true),
    supabase!.from("locations").select("*").eq("kind", "store").eq("active", true).order("name"),
  ]);
  const stores = (locations ?? []) as Location[];
  return <>
    <PageHeader title="Campanhas sazonais" description="Configure Natal, Páscoa e outras épocas com período de aceitação, menu e dias próprios de levantamento." />
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>Nova campanha</CardTitle></CardHeader><CardContent><SeasonalCampaignForm /></CardContent></Card>
      <Card><CardHeader><CardTitle>Novo artigo do menu especial</CardTitle></CardHeader><CardContent><SeasonalProductForm campaigns={campaigns} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Novo levantamento especial</CardTitle></CardHeader><CardContent><SeasonalPickupSlotForm campaigns={campaigns} stores={stores} /></CardContent></Card>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Campanhas configuradas</h2>
        {!campaigns.length && <Card><CardContent className="py-10 text-center text-muted-foreground">Ainda não existem campanhas sazonais.</CardContent></Card>}
        {campaigns.map((campaign) => {
          const state = periodState(campaign.ordering_opens_at, campaign.ordering_closes_at);
          return <Card key={campaign.id} className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><Gift className="size-5 text-primary" /><CardTitle>{campaign.name}</CardTitle><Badge variant={campaign.active ? state.variant : "outline"}>{campaign.active ? state.label : "Inativa"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{campaign.description || "Sem descrição"}</p><p className="mt-2 text-sm"><strong>Aceitação:</strong> {formatDateTime(campaign.ordering_opens_at)} – {formatDateTime(campaign.ordering_closes_at)}</p></div><SeasonalToggleButton kind="campaign" id={campaign.id} active={campaign.active} /></div></CardHeader>
            <CardContent className="grid gap-6 pt-5 lg:grid-cols-2">
              <div><h3 className="mb-3 flex items-center gap-2 font-semibold"><Utensils className="size-4 text-primary" />Menu especial</h3><div className="space-y-2">{campaign.products?.length ? campaign.products.sort((a, b) => a.position - b.position).map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">mín. {formatQuantity(product.minimum_quantity)} · passo {formatQuantity(product.quantity_step)} {product.unit_label}{product.requires_note ? " · nota obrigatória" : ""}</p></div><SeasonalToggleButton kind="product" id={product.id} active={product.active} /></div>) : <p className="text-sm text-muted-foreground">Sem artigos.</p>}</div></div>
              <div><h3 className="mb-3 flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-primary" />Dias de levantamento</h3><div className="space-y-2">{campaign.pickup_slots?.length ? campaign.pickup_slots.sort((a, b) => a.pickup_date.localeCompare(b.pickup_date) || a.opens_at.localeCompare(b.opens_at)).map((slot) => <div key={slot.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">{formatDate(`${slot.pickup_date}T12:00:00Z`)} · {slot.opens_at.slice(0, 5)}–{slot.closes_at.slice(0, 5)}</p><p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{slot.location?.name} · escolhas a cada {slot.slot_minutes} min</p></div><SeasonalToggleButton kind="slot" id={slot.id} active={slot.active} /></div>) : <p className="text-sm text-muted-foreground">Sem dias configurados.</p>}</div></div>
            </CardContent>
          </Card>;
        })}
      </section>
    </div>
  </>;
}
