import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { getSeasonalCampaign } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { SeasonalReportBuilder } from "@/components/seasonal-report-builder";
import { Button } from "@/components/ui/button";

const presets = new Set(["order-sheets", "product-totals", "product-totals-day"]);

export default async function SeasonalReportsPage({ params, searchParams }: PageProps<"/admin/sazonais/[campaignId]/relatorios">) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(campaignId).success) notFound();
  const campaign = await getSeasonalCampaign(campaignId);
  if (!campaign) notFound();
  const preset = typeof query.preset === "string" && presets.has(query.preset) ? query.preset : undefined;

  return <>
    <PageHeader title={`Exportar · ${campaign.name}`} description="Crie folhas por encomenda ou um resumo dos totais por artigo." actions={<Button asChild variant="outline"><Link href={`/admin/sazonais/${campaign.id}`}><ArrowLeft data-icon="inline-start" />Campanha</Link></Button>} />
    <SeasonalReportBuilder
      campaignId={campaign.id}
      initialPreset={preset}
      products={(campaign.products ?? []).map((product) => ({ id: product.id, name: product.name })).sort((a, b) => a.name.localeCompare(b.name, "pt"))}
    />
  </>;
}
