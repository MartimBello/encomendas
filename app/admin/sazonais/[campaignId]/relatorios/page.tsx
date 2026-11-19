import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CircleCheck, Euro, Pencil, ShoppingBasket } from "lucide-react";
import { z } from "zod";
import { getSeasonalCampaign, getSeasonalExportOrders } from "@/lib/data";
import { formatCurrency, orderRevenueEstimate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { SeasonalReportBuilder } from "@/components/seasonal-report-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const presets = new Set(["order-sheets", "product-totals", "product-totals-day"]);

export default async function SeasonalReportsPage({ params, searchParams }: PageProps<"/admin/sazonais/[campaignId]/relatorios">) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(campaignId).success) notFound();
  const [campaign, orders] = await Promise.all([getSeasonalCampaign(campaignId), getSeasonalExportOrders(campaignId)]);
  if (!campaign) notFound();
  const preset = typeof query.preset === "string" && presets.has(query.preset) ? query.preset : undefined;
  const accepted = orders.filter((order) => order.status === "accepted");
  const cancelled = orders.filter((order) => order.status === "cancelled");
  const revenue = orderRevenueEstimate(accepted.flatMap((order) => order.revision?.items ?? []));

  return <>
    <PageHeader title={`Relatórios · ${campaign.name}`} description="Acompanhe os principais números da campanha e gere os PDFs operacionais." actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/sazonais"><ArrowLeft data-icon="inline-start" />Campanhas</Link></Button><Button asChild variant="outline"><Link href={`/admin/sazonais/${campaign.id}`}><Pencil data-icon="inline-start" />Editar campanha</Link></Button></div>} />
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="text-sm font-medium">Receita prevista</CardTitle><Euro className="text-muted-foreground" /></CardHeader><CardContent><p className="text-2xl font-semibold">{revenue ? formatCurrency(revenue.totalCents) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{revenue ? revenue.complete ? "Encomendas aceites" : "Estimativa parcial · existem artigos sem preço" : "Sem preços definidos nas encomendas"}</p></CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="text-sm font-medium">Encomendas</CardTitle><ShoppingBasket className="text-muted-foreground" /></CardHeader><CardContent><p className="text-2xl font-semibold">{orders.length}</p><p className="mt-1 text-xs text-muted-foreground">Total registado na campanha</p></CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="text-sm font-medium">Aceites</CardTitle><CircleCheck className="text-muted-foreground" /></CardHeader><CardContent><p className="text-2xl font-semibold">{accepted.length}</p><p className="mt-1 text-xs text-muted-foreground">Incluídas nos relatórios</p></CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="text-sm font-medium">Canceladas</CardTitle><Ban className="text-muted-foreground" /></CardHeader><CardContent><p className="text-2xl font-semibold">{cancelled.length}</p><p className="mt-1 text-xs text-muted-foreground">Excluídas da receita e dos relatórios</p></CardContent></Card>
    </div>
    <SeasonalReportBuilder
      campaignId={campaign.id}
      initialPreset={preset}
      products={(campaign.products ?? []).map((product) => ({ id: product.id, name: product.name })).sort((a, b) => a.name.localeCompare(b.name, "pt"))}
    />
  </>;
}
