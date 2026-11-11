import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Location, PickupWindow } from "@/lib/domain";
import { LocationForm, ToggleButton, WindowForm } from "@/components/admin-forms";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function LocationsPage() {
  const supabase = await createClient();
  const [{ data: locations }, { data: windows }] = await Promise.all([
    supabase!.from("locations").select("*").order("kind").order("name"),
    supabase!.from("pickup_windows").select("*").order("weekday").order("opens_at"),
  ]);
  const typedLocations = (locations ?? []) as Location[];
  const typedWindows = (windows ?? []) as PickupWindow[];
  const stores = typedLocations.filter((location) => location.kind === "store" && location.active);
  const activeLocations = typedLocations.filter((location) => location.active).length;

  return <>
    <PageHeader title="Locais" description="Faça a gestão das lojas, cozinhas e respetivos horários semanais de levantamento." />
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo dos locais">
        <Card><CardHeader><CardDescription>Locais ativos</CardDescription><CardTitle className="text-2xl">{activeLocations}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">de {typedLocations.length} locais configurados</CardContent></Card>
        <Card><CardHeader><CardDescription>Lojas ativas</CardDescription><CardTitle className="text-2xl">{stores.length}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Disponíveis para levantamento</CardContent></Card>
        <Card><CardHeader><CardDescription>Horários</CardDescription><CardTitle className="text-2xl">{typedWindows.length}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Períodos semanais configurados</CardContent></Card>
      </section>

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
    </div>
  </>;
}
