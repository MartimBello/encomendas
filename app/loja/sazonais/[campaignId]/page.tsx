import { notFound } from "next/navigation";
import { getSeasonalCampaign, defaultSettings } from "@/lib/data";
import type { OrderingSettings } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SeasonalOrderForm } from "@/components/seasonal-order-form";
import { Card, CardContent } from "@/components/ui/card";

function isCampaignAccepting(opensAt: string, closesAt: string) {
  const now = Date.now(); return now >= new Date(opensAt).getTime() && now <= new Date(closesAt).getTime();
}

export default async function NewSeasonalOrderPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const [campaign, { data: settings }] = await Promise.all([getSeasonalCampaign(campaignId), supabase!.from("ordering_settings").select("*").eq("id", true).single()]);
  if (!campaign?.active) notFound();
  const accepting = isCampaignAccepting(campaign.ordering_opens_at, campaign.ordering_closes_at);
  return <><PageHeader title={`Nova encomenda · ${campaign.name}`} description={campaign.description || "Escolha os artigos do menu especial e o levantamento."} />{accepting ? <SeasonalOrderForm campaign={campaign} settings={(settings ?? defaultSettings) as OrderingSettings} /> : <Card><CardContent className="py-12 text-center"><h2 className="font-semibold">Campanha fora do período de aceitação</h2><p className="mt-2 text-sm text-muted-foreground">Não é possível registar novas encomendas nesta campanha.</p></CardContent></Card>}</>;
}
