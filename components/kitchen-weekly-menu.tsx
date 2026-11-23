"use client";

import { useState } from "react";
import { Check, Clock3, Store, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Location, WeeklyMenuOrder } from "@/lib/domain";
import type { WeeklyMenu } from "@/lib/weekly-menu-schema";
import { cn } from "@/lib/utils";

function dateForDay(referenceDate: string, offset: number) {
  const date = new Date(`${referenceDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", timeZone: "UTC" }).format(date).replace(".", "");
}

function updatedLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function KitchenWeeklyMenu({ menu, orders, stores }: { menu: WeeklyMenu; orders: WeeklyMenuOrder[]; stores: Location[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const initialDay = Math.max(0, Math.min(menu.dias.length - 1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${menu.dataReferencia}T12:00:00Z`)) / 86_400_000)));
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const selected = menu.dias[selectedDay];
  const ordersByStore = new Map(orders.map((order) => [order.store_id, order]));
  const expectedDishCount = menu.categorias.reduce((total, category) => total + (selected.pratos[category.key] ?? []).length, 0);
  const completed = stores.filter((store) => {
    const decided = new Set((ordersByStore.get(store.id)?.items ?? []).filter((item) => item.day_key === selected.dia).map((item) => `${item.category_key}\u001f${item.dish_name}`));
    return menu.categorias.every((category) => (selected.pratos[category.key] ?? []).every((dishName) => decided.has(`${category.key}\u001f${dishName}`)));
  }).length;

  return <div className="space-y-5">
    <Card className="border-primary/25">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><UtensilsCrossed className="size-5" /></span>
          <div><p className="font-semibold">{menu.ementa}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Ementa atualizada em {updatedLabel(menu.ultimaAtualizacao)}</p></div>
        </div>
        <Badge variant={completed === stores.length && stores.length > 0 ? "accepted" : "pending"}>{completed} de {stores.length} lojas concluíram {selected.diaLabel.replace("-feira", "")}</Badge>
      </CardContent>
    </Card>

    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2" role="tablist" aria-label="Dias da ementa">
        {menu.dias.map((day, index) => <button
          key={day.dia}
          type="button"
          role="tab"
          aria-selected={selectedDay === index}
          onClick={() => setSelectedDay(index)}
          className={cn("min-w-28 rounded-xl border px-4 py-3 text-left transition-colors", selectedDay === index ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:bg-muted")}
        >
          <span className="block text-sm font-semibold">{day.diaLabel.replace("-feira", "")}</span>
          <span className={cn("text-xs", selectedDay === index ? "text-primary-foreground/75" : "text-muted-foreground")}>{dateForDay(menu.dataReferencia, index)}</span>
        </button>)}
      </div>
    </div>

    <div><h2 className="text-xl font-semibold">{selected.diaLabel}</h2><p className="text-sm text-muted-foreground">{dateForDay(menu.dataReferencia, selectedDay)} · encomendas separadas por loja</p></div>

    {stores.length ? <div className="grid items-start gap-4 xl:grid-cols-2">
      {stores.map((store) => {
        const order = ordersByStore.get(store.id);
        const dayItems = (order?.items ?? []).filter((item) => item.day_key === selected.dia);
        const itemsByDish = new Map(dayItems.map((item) => [`${item.category_key}\u001f${item.dish_name}`, item]));
        const decidedCount = menu.categorias.reduce((total, category) => total + (selected.pratos[category.key] ?? []).filter((dishName) => itemsByDish.has(`${category.key}\u001f${dishName}`)).length, 0);
        const dayCompleted = decidedCount === expectedDishCount;
        return <Card key={store.id} role="article" aria-label={`Encomenda de ${store.name}`} className={!order ? "border-dashed" : ""}>
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Store className="size-5" /></span><div><CardTitle>{store.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{store.address}</p></div></div>
              <Badge variant={dayCompleted ? "accepted" : "pending"}>{dayCompleted ? <><Check className="mr-1 size-3" />Concluído</> : decidedCount > 0 ? "Incompleto" : "Por receber"}</Badge>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">{decidedCount} de {expectedDishCount} produtos decididos{order ? ` · última alteração: ${updatedLabel(order.updated_at)}` : ""}</p>
          </CardHeader>
          <CardContent className="p-0">
            {!dayCompleted && <p className="border-b bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900">Faltam decisões para {expectedDishCount - decidedCount} produto{expectedDishCount - decidedCount === 1 ? "" : "s"}.</p>}
            <div className="divide-y">
              {menu.categorias.map((category) => {
                const dishNames = selected.pratos[category.key] ?? [];
                if (!dishNames.length) return null;
                return <section key={category.key} className="py-3">
                  <h3 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.label}</h3>
                  <Table>
                    <TableHeader><TableRow><TableHead>Prato</TableHead><TableHead className="w-16 text-center">P</TableHead><TableHead className="w-16 text-center">M</TableHead><TableHead className="w-20 text-center">Pirex</TableHead><TableHead className="w-20 text-center">Unid.</TableHead></TableRow></TableHeader>
                    <TableBody>{dishNames.map((dishName) => {
                      const item = itemsByDish.get(`${category.key}\u001f${dishName}`);
                      return <TableRow key={dishName}><TableCell className="font-medium"><span>{dishName}</span>{!item ? <Badge variant="pending" className="ml-2">Por decidir</Badge> : item.not_required ? <Badge variant="outline" className="ml-2">Não necessário</Badge> : null}</TableCell><TableCell className="text-center tabular-nums">{item?.box_p_quantity || "—"}</TableCell><TableCell className="text-center tabular-nums">{item?.box_m_quantity || "—"}</TableCell><TableCell className="text-center tabular-nums">{item?.pirex_quantity ?? "—"}</TableCell><TableCell className="text-center tabular-nums">{item?.unit_quantity ?? "—"}</TableCell></TableRow>;
                    })}</TableBody>
                  </Table>
                </section>;
              })}
            </div>
          </CardContent>
        </Card>;
      })}
    </div> : <EmptyState title="Sem lojas ativas" description="Não existem lojas ativas para apresentar nesta ementa." icon={Store} />}
  </div>;
}
