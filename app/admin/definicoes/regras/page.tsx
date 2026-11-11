import { createClient } from "@/lib/supabase/server";
import { defaultSettings } from "@/lib/data";
import type { OrderingSettings } from "@/lib/domain";
import { OrderingRulesForm } from "@/components/admin-forms";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OrderingRulesPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase!.from("ordering_settings").select("*").eq("id", true).single();
  const currentSettings = (settings ?? defaultSettings) as OrderingSettings;

  return <>
    <PageHeader title="Regras de encomenda" description="Defina os dados obrigatórios, a antecedência mínima e o horizonte disponível para novas encomendas." />
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Resumo das regras de encomenda">
        <Card><CardHeader><CardDescription>Antecedência mínima</CardDescription><CardTitle className="text-2xl">{currentSettings.minimum_lead_minutes} min</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Tempo mínimo entre o registo e o levantamento</CardContent></Card>
        <Card><CardHeader><CardDescription>Horizonte de reserva</CardDescription><CardTitle className="text-2xl">{currentSettings.booking_horizon_days} dias</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Período futuro disponível para escolher um levantamento</CardContent></Card>
      </section>
      <Card>
        <CardHeader><CardTitle>Configuração</CardTitle><CardDescription>Estas regras aplicam-se às encomendas normais registadas pelas lojas.</CardDescription></CardHeader>
        <CardContent><OrderingRulesForm settings={currentSettings} /></CardContent>
      </Card>
    </div>
  </>;
}
