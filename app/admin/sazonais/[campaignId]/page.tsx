import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Utensils } from "lucide-react";
import { z } from "zod";
import { getSeasonalCampaign } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { Location } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { formatQuantity } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { SeasonalCampaignEditForm, SeasonalDeleteButton, SeasonalPickupSlotEditForm, SeasonalPickupSlotForm, SeasonalProductEditForm, SeasonalProductForm, SeasonalToggleButton } from "@/components/seasonal-admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function periodState(opens: string, closes: string) {
  const now = Date.now();
  if (now < new Date(opens).getTime()) return { label: "Agendada", variant: "info" as const };
  if (now > new Date(closes).getTime()) return { label: "Encerrada", variant: "cancelled" as const };
  return { label: "A aceitar", variant: "accepted" as const };
}

export default async function SeasonalCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  if (!z.uuid().safeParse(campaignId).success) notFound();

  const supabase = await createClient();
  const [campaign, { data: locations }, { data: categories }] = await Promise.all([
    getSeasonalCampaign(campaignId),
    supabase!.from("locations").select("*").eq("kind", "store").eq("active", true).order("name"),
    supabase!.from("product_categories").select("id,name").eq("active", true).order("position"),
  ]);
  if (!campaign) notFound();

  const stores = (locations ?? []) as Location[];
  const state = periodState(campaign.ordering_opens_at, campaign.ordering_closes_at);
  const products = [...(campaign.products ?? [])].sort((a, b) => (a.category?.position ?? Number.MAX_SAFE_INTEGER) - (b.category?.position ?? Number.MAX_SAFE_INTEGER) || a.position - b.position);
  const pickupSlots = [...(campaign.pickup_slots ?? [])].sort((a, b) => a.pickup_date.localeCompare(b.pickup_date) || a.opens_at.localeCompare(b.opens_at));

  return <>
    <PageHeader
      title={campaign.name}
      description="Edite todos os detalhes desta campanha sazonal, incluindo o menu, a aceitação de encomendas e os levantamentos."
      actions={<><Button asChild variant="outline"><Link href="/admin/sazonais"><ArrowLeft data-icon="inline-start" />Campanhas</Link></Button><SeasonalToggleButton kind="campaign" id={campaign.id} active={campaign.active} /></>}
    />
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="flex flex-col gap-1.5"><div className="flex flex-wrap items-center gap-2"><CardTitle>Definições da campanha</CardTitle><Badge variant={campaign.active ? state.variant : "outline"}>{campaign.active ? state.label : "Inativa"}</Badge></div><CardDescription>Nome, descrição, identificador e janela de aceitação de encomendas.</CardDescription></div>
            <SeasonalCampaignEditForm campaign={campaign} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identificador</p><p className="mt-1 font-mono text-sm">{campaign.slug}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Início da aceitação</p><p className="mt-1 text-sm">{formatDateTime(campaign.ordering_opens_at)}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fim da aceitação</p><p className="mt-1 text-sm">{formatDateTime(campaign.ordering_closes_at)}</p></div>
          <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição para as lojas</p><p className="mt-1 text-sm">{campaign.description || "Sem descrição"}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Utensils />Artigos do menu</CardTitle><CardDescription>Adicione e edite os artigos disponíveis apenas nesta campanha.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-5">
          <SeasonalProductForm campaignId={campaign.id} categories={categories ?? []} />
          <Separator />
          <Table>
            <TableHeader><TableRow><TableHead>Artigo</TableHead><TableHead>Quantidade</TableHead><TableHead>Stock</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {products.map((product) => <TableRow key={product.id} aria-label={`Artigo ${product.name}`}><TableCell><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.category?.name ?? "Outros"}{product.requires_note ? " · nota obrigatória" : ""}</p>{product.variations.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Opções: {product.variations.join(" · ")}</p>}</TableCell><TableCell>{product.quantity_mode === "selection" ? "Seleção por opção" : product.quantity_mode === "unit_weight" ? `mín. ${formatQuantity(product.minimum_quantity)} un. · peso em ${product.unit_weight_label}` : `mín. ${formatQuantity(product.minimum_quantity)} · passo ${formatQuantity(product.quantity_step)} ${product.unit_label}`}</TableCell><TableCell>{product.stock_limit !== null ? formatQuantity(product.stock_limit) : "Sem limite"}</TableCell><TableCell><Badge variant={product.active ? "accepted" : "cancelled"}>{product.active ? "Ativo" : "Inativo"}</Badge></TableCell><TableCell><div className="flex flex-wrap justify-end gap-2"><SeasonalProductEditForm product={product} categories={categories ?? []} /><SeasonalToggleButton kind="product" id={product.id} active={product.active} /><SeasonalDeleteButton kind="product" id={product.id} name={product.name} /></div></TableCell></TableRow>)}
              {!products.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Ainda não existem artigos nesta campanha.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock />Dias de levantamento</CardTitle><CardDescription>Configure as lojas, datas, horários e intervalos disponíveis para levantamento.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-5">
          <SeasonalPickupSlotForm campaignId={campaign.id} stores={stores} />
          <Separator />
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Loja</TableHead><TableHead>Horário</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {pickupSlots.map((slot) => <TableRow key={slot.id} aria-label={`Levantamento ${formatDate(`${slot.pickup_date}T12:00:00Z`)} ${slot.location?.name ?? "Loja"}`}><TableCell className="font-medium">{formatDate(`${slot.pickup_date}T12:00:00Z`)}</TableCell><TableCell>{slot.location?.name}</TableCell><TableCell>{slot.opens_at.slice(0, 5)}–{slot.closes_at.slice(0, 5)} · escolhas a cada {slot.slot_minutes} min</TableCell><TableCell><Badge variant={slot.active ? "accepted" : "cancelled"}>{slot.active ? "Ativo" : "Inativo"}</Badge></TableCell><TableCell><div className="flex flex-wrap justify-end gap-2"><SeasonalPickupSlotEditForm slot={slot} stores={stores} /><SeasonalToggleButton kind="slot" id={slot.id} active={slot.active} /><SeasonalDeleteButton kind="slot" id={slot.id} name={`${formatDate(`${slot.pickup_date}T12:00:00Z`)} · ${slot.location?.name ?? "Loja"}`} /></div></TableCell></TableRow>)}
              {!pickupSlots.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Ainda não existem dias de levantamento nesta campanha.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </>;
}
