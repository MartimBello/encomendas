import { Archive, CalendarClock, ClipboardCheck, MapPinned } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { defaultSettings } from "@/lib/data";
import type { Location, OrderingSettings, PickupWindow } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationForm, OrderingRulesForm, RetentionSettingsForm, ToggleButton, WindowForm } from "@/components/admin-forms";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: locations }, { data: windows }] = await Promise.all([
    supabase!.from("ordering_settings").select("*").eq("id", true).single(),
    supabase!.from("locations").select("*").order("kind").order("name"),
    supabase!.from("pickup_windows").select("*").order("weekday").order("opens_at"),
  ]);
  const currentSettings = (settings ?? defaultSettings) as OrderingSettings;
  const typedLocations = (locations ?? []) as Location[];
  const typedWindows = (windows ?? []) as PickupWindow[];
  const stores = typedLocations.filter((location) => location.kind === "store" && location.active);
  const activeLocations = typedLocations.filter((location) => location.active).length;

  return <>
    <PageHeader title="Definições" description="Configure as regras operacionais, os locais e a retenção de dados a partir de um único dashboard." />
    <div className="@container/main flex flex-col gap-5">
      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumo das definições">
        <Card>
          <CardHeader><CardDescription>Regras de encomenda</CardDescription><CardTitle className="text-2xl">{currentSettings.minimum_lead_minutes} min</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Antecedência mínima · horizonte de {currentSettings.booking_horizon_days} dias</CardContent>
        </Card>
        <Card>
          <CardHeader><CardDescription>Locais</CardDescription><CardTitle className="text-2xl">{activeLocations} ativos</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{typedWindows.length} horários de levantamento configurados</CardContent>
        </Card>
        <Card>
          <CardHeader><CardDescription>Retenção de dados</CardDescription><CardTitle className="text-2xl">{currentSettings.retention_months} meses</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Período aplicado aos dados pessoais das encomendas</CardContent>
        </Card>
      </section>

      <Tabs defaultValue="rules">
        <TabsList aria-label="Secções das definições">
          <TabsTrigger value="rules"><ClipboardCheck />Regras de encomenda</TabsTrigger>
          <TabsTrigger value="locations"><MapPinned />Locais</TabsTrigger>
          <TabsTrigger value="retention"><Archive />Retenção de dados</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader><CardTitle>Regras de encomenda</CardTitle><CardDescription>Defina os dados obrigatórios, a antecedência mínima e o horizonte disponível para novas encomendas.</CardDescription></CardHeader>
            <CardContent><OrderingRulesForm settings={currentSettings} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Novo local</CardTitle><CardDescription>Adicione uma loja ou cozinha à operação.</CardDescription></CardHeader>
              <CardContent><LocationForm /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock />Novos horários de levantamento</CardTitle><CardDescription>Associe o mesmo período a um ou mais dias de uma loja.</CardDescription></CardHeader>
              <CardContent><WindowForm stores={stores} /></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Locais e horários</CardTitle><CardDescription>Consulte o estado de cada local e os respetivos períodos semanais de levantamento.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Local</TableHead><TableHead>Tipo</TableHead><TableHead>Morada</TableHead><TableHead>Horários</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
                <TableBody>
                  {typedLocations.map((location) => {
                    const locationWindows = typedWindows.filter((window) => window.location_id === location.id);
                    return <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>{location.kind === "kitchen" ? "Cozinha" : "Loja"}</TableCell>
                      <TableCell>{location.address}</TableCell>
                      <TableCell><div className="flex min-w-64 flex-wrap gap-1.5">{locationWindows.map((window) => <Badge key={window.id} variant="secondary">{weekdays[window.weekday]} {window.opens_at.slice(0, 5)}–{window.closes_at.slice(0, 5)} · {window.slot_minutes} min</Badge>)}{!locationWindows.length && <span className="text-sm text-muted-foreground">{location.kind === "kitchen" ? "Não aplicável" : "Sem horários"}</span>}</div></TableCell>
                      <TableCell><Badge variant={location.active ? "accepted" : "cancelled"}>{location.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell className="text-right"><ToggleButton kind="location" id={location.id} active={location.active} /></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention">
          <Card>
            <CardHeader><CardTitle>Retenção de dados</CardTitle><CardDescription>Defina durante quantos meses os dados pessoais associados às encomendas devem ser conservados.</CardDescription></CardHeader>
            <CardContent className="max-w-xl"><RetentionSettingsForm settings={currentSettings} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </>;
}
