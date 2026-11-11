import { createClient } from "@/lib/supabase/server";
import { defaultSettings } from "@/lib/data";
import type { OrderingSettings } from "@/lib/domain";
import { RetentionSettingsForm } from "@/components/admin-forms";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RetentionSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase!.from("ordering_settings").select("*").eq("id", true).single();
  const currentSettings = (settings ?? defaultSettings) as OrderingSettings;

  return <>
    <PageHeader title="Retenção de dados" description="Configure durante quanto tempo os dados pessoais associados às encomendas devem ser conservados." />
    <div className="flex flex-col gap-5">
      <Card><CardHeader><CardDescription>Período atual</CardDescription><CardTitle className="text-2xl">{currentSettings.retention_months} meses</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Aplicado aos dados pessoais existentes nas encomendas</CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Configuração</CardTitle><CardDescription>Escolha um período entre 1 e 120 meses.</CardDescription></CardHeader>
        <CardContent className="max-w-xl"><RetentionSettingsForm settings={currentSettings} /></CardContent>
      </Card>
    </div>
  </>;
}
