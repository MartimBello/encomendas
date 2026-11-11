import { notFound } from "next/navigation";
import { defaultSettings, getOrder, getOrderFormOptions, getSeasonalCampaign } from "@/lib/data";
import type { OrderingSettings } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/components/order-form";
import { SeasonalOrderForm } from "@/components/seasonal-order-form";
import { PageHeader } from "@/components/page-header";

export default async function EditOrderPage({ params }: PageProps<"/loja/encomendas/[id]/editar">) {
  const { id } = await params;
  const result = await getOrder(id);
  if (!result?.order.revision || result.order.status === "cancelled") notFound();

  if (result.order.campaign_id) {
    const supabase = await createClient();
    const [campaign, { data: settings }] = await Promise.all([
      getSeasonalCampaign(result.order.campaign_id),
      supabase!.from("ordering_settings").select("*").eq("id", true).single(),
    ]);
    if (!campaign) notFound();
    return <><PageHeader title={`Editar ${result.order.order_number}`} description="A alteração cria uma nova versão sazonal e confirma-a automaticamente." /><SeasonalOrderForm campaign={campaign} settings={(settings ?? defaultSettings) as OrderingSettings} orderId={id} initial={result.order.revision} /></>;
  }

  const options = await getOrderFormOptions();
  return <><PageHeader title={`Rever ${result.order.order_number}`} description="A alteração cria uma nova versão e volta a pedir confirmação à cozinha." /><OrderForm {...options} orderId={id} initial={result.order.revision} /></>;
}
