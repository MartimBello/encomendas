"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Clock3, LoaderCircle, PackageCheck, Save, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { saveWeeklyMenuOrderAction } from "@/app/loja/ementa/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WeeklyMenuOrder } from "@/lib/domain";
import type { WeeklyMenu } from "@/lib/weekly-menu-schema";

type QuantityState = {
  mode: "boxes" | "pirex" | "unit" | "not_required";
  boxP: number;
  boxM: number;
  pirexQuantity: number;
  unitQuantity: number;
};

const EMPTY_QUANTITY: QuantityState = { mode: "boxes", boxP: 0, boxM: 0, pirexQuantity: 1, unitQuantity: 1 };

function itemKey(dayKey: string, categoryKey: string, dishName: string) {
  return `${dayKey}\u001f${categoryKey}\u001f${dishName}`;
}

function dateForDay(referenceDate: string, offset: number) {
  const date = new Date(`${referenceDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", timeZone: "UTC" }).format(date).replace(".", "");
}

function updatedLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function hasDecision(quantity: QuantityState | undefined) {
  if (!quantity) return false;
  if (quantity.mode === "not_required") return true;
  if (quantity.mode === "pirex") return quantity.pirexQuantity > 0;
  if (quantity.mode === "unit") return quantity.unitQuantity > 0;
  return quantity.boxP > 0 || quantity.boxM > 0;
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className={cn("grid min-w-20 gap-1 text-xs font-semibold text-muted-foreground", disabled && "opacity-45")}>
    <span>{label}</span>
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={9999}
      step={1}
      disabled={disabled}
      value={value || ""}
      placeholder="0"
      aria-label={label}
      className="h-10 min-h-10 px-2 text-center tabular-nums"
      onChange={(event) => onChange(Math.min(9999, Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0)))}
    />
  </label>;
}

export function WeeklyMenuOrderForm({ menu, savedOrder }: { menu: WeeklyMenu; savedOrder: WeeklyMenuOrder | null }) {
  const initialQuantities = useMemo(() => Object.fromEntries((savedOrder?.items ?? []).map((item) => [
    itemKey(item.day_key, item.category_key, item.dish_name),
    {
      mode: item.not_required ? "not_required" : item.unit_quantity !== null ? "unit" : item.pirex_quantity !== null ? "pirex" : "boxes",
      boxP: item.box_p_quantity,
      boxM: item.box_m_quantity,
      pirexQuantity: item.pirex_quantity ?? 1,
      unitQuantity: item.unit_quantity ?? 1,
    } satisfies QuantityState,
  ])), [savedOrder]);
  const today = new Date().toISOString().slice(0, 10);
  const initialDay = Math.max(0, Math.min(menu.dias.length - 1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${menu.dataReferencia}T12:00:00Z`)) / 86_400_000)));
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [quantities, setQuantities] = useState<Record<string, QuantityState>>(initialQuantities);
  const [lastSavedAt, setLastSavedAt] = useState(savedOrder?.updated_at ?? null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const updateQuantity = (key: string, change: Partial<QuantityState>) => {
    setDirty(true);
    setQuantities((current) => ({ ...current, [key]: { ...(current[key] ?? EMPTY_QUANTITY), ...change } }));
  };

  const selected = menu.dias[selectedDay];
  const totalDishes = menu.dias.reduce((total, day) => total + menu.categorias.reduce((dayTotal, category) => dayTotal + (day.pratos[category.key] ?? []).length, 0), 0);
  const summary = Object.values(quantities).reduce((total, item) => ({
    decisions: total.decisions + (hasDecision(item) ? 1 : 0),
    boxes: total.boxes + (item.mode === "boxes" ? item.boxP + item.boxM : 0),
    pirex: total.pirex + (item.mode === "pirex" ? item.pirexQuantity : 0),
    units: total.units + (item.mode === "unit" ? item.unitQuantity : 0),
  }), { decisions: 0, boxes: 0, pirex: 0, units: 0 });
  const selectedDishCount = menu.categorias.reduce((total, category) => total + (selected.pratos[category.key] ?? []).length, 0);
  const selectedDecisionCount = menu.categorias.reduce((total, category) => total + (selected.pratos[category.key] ?? []).filter((dishName) => hasDecision(quantities[itemKey(selected.dia, category.key, dishName)])).length, 0);
  const selectedComplete = selectedDecisionCount === selectedDishCount;

  const save = () => startTransition(async () => {
    const items = [];
    for (const day of menu.dias) {
      for (const category of menu.categorias) {
        for (const dishName of day.pratos[category.key] ?? []) {
          const quantity = quantities[itemKey(day.dia, category.key, dishName)] ?? EMPTY_QUANTITY;
          if (quantity.mode === "pirex" && quantity.pirexQuantity > 0) {
            items.push({ day_key: day.dia, category_key: category.key, dish_name: dishName, box_p_quantity: 0, box_m_quantity: 0, pirex_quantity: quantity.pirexQuantity, unit_quantity: null, not_required: false });
          } else if (quantity.mode === "unit" && quantity.unitQuantity > 0) {
            items.push({ day_key: day.dia, category_key: category.key, dish_name: dishName, box_p_quantity: 0, box_m_quantity: 0, pirex_quantity: null, unit_quantity: quantity.unitQuantity, not_required: false });
          } else if (quantity.mode === "not_required") {
            items.push({ day_key: day.dia, category_key: category.key, dish_name: dishName, box_p_quantity: 0, box_m_quantity: 0, pirex_quantity: null, unit_quantity: null, not_required: true });
          } else if (quantity.mode === "boxes" && (quantity.boxP > 0 || quantity.boxM > 0)) {
            items.push({ day_key: day.dia, category_key: category.key, dish_name: dishName, box_p_quantity: quantity.boxP, box_m_quantity: quantity.boxM, pirex_quantity: null, unit_quantity: null, not_required: false });
          }
        }
      }
    }
    const result = await saveWeeklyMenuOrderAction({ reference_date: menu.dataReferencia, items });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setDirty(false);
    setLastSavedAt(new Date().toISOString());
    toast.success(result.message);
  });

  return <div className="space-y-5">
    <Card className="overflow-hidden border-primary/25">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><UtensilsCrossed className="size-5" /></span>
          <div><p className="font-semibold">{menu.ementa}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Ementa atualizada em {updatedLabel(menu.ultimaAtualizacao)}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{summary.decisions} de {totalDishes} pratos decididos</Badge>
          <Badge variant="outline">{summary.boxes} caixas</Badge>
          <Badge variant="outline">{summary.pirex} Pirex</Badge>
          <Badge variant="outline">{summary.units} unidades</Badge>
        </div>
      </CardContent>
    </Card>

    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2" role="tablist" aria-label="Dias da ementa">
        {menu.dias.map((day, index) => {
          const dishCount = menu.categorias.reduce((total, category) => total + (day.pratos[category.key] ?? []).length, 0);
          const decisionCount = menu.categorias.reduce((total, category) => total + (day.pratos[category.key] ?? []).filter((dishName) => hasDecision(quantities[itemKey(day.dia, category.key, dishName)])).length, 0);
          const completed = decisionCount === dishCount;
          return <button
            key={day.dia}
            type="button"
            role="tab"
            aria-selected={selectedDay === index}
            onClick={() => setSelectedDay(index)}
            className={cn("relative min-w-28 rounded-xl border px-4 py-3 text-left transition-colors", selectedDay === index ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:bg-muted")}
          >
            <span className="block text-sm font-semibold">{day.diaLabel.replace("-feira", "")}</span>
            <span className={cn("text-xs", selectedDay === index ? "text-primary-foreground/75" : "text-muted-foreground")}>{dateForDay(menu.dataReferencia, index)}</span>
            {completed ? <span title="Dia concluído" className={cn("absolute right-2 top-2 grid size-4 place-items-center rounded-full", selectedDay === index ? "bg-white text-primary" : "bg-emerald-600 text-white")}><Check className="size-3" /></span> : decisionCount > 0 ? <span title={`${decisionCount} de ${dishCount} pratos decididos`} className={cn("absolute right-2 top-2 size-2.5 rounded-full", selectedDay === index ? "bg-amber-200" : "bg-amber-500")} /> : null}
          </button>;
        })}
      </div>
    </div>

    <div role="tabpanel" className="space-y-4">
      <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">{selected.diaLabel}</h2><p className="text-sm text-muted-foreground">{dateForDay(menu.dataReferencia, selectedDay)}</p></div><p className="hidden text-xs text-muted-foreground sm:block">Escolha caixas P/M, Pirex ou unidades</p></div>
      <Card className={selectedComplete ? "border-emerald-300 bg-emerald-50/60" : "border-amber-300 bg-amber-50/60"}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold">{selectedComplete ? "Dia completo" : "Dia incompleto"}</p><p className="text-sm text-muted-foreground">Introduza uma quantidade ou marque “Não necessário” em todos os pratos.</p></div>
          <Badge variant={selectedComplete ? "accepted" : "pending"}>{selectedDecisionCount} de {selectedDishCount} decididos</Badge>
        </CardContent>
      </Card>
      {menu.categorias.map((category) => {
        const dishes = selected.pratos[category.key] ?? [];
        if (!dishes.length) return null;
        return <Card key={category.key}>
          <CardHeader className="border-b bg-muted/35 px-4 py-3 sm:px-5"><CardTitle className="text-base">{category.label}</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {dishes.map((dishName) => {
              const key = itemKey(selected.dia, category.key, dishName);
              const quantity = quantities[key] ?? EMPTY_QUANTITY;
              return <div key={dishName} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(180px,1fr)_auto] sm:items-center sm:px-5">
                <p className="font-medium leading-snug">{dishName}</p>
                <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                  <NumberField label="Box P" value={quantity.boxP} disabled={quantity.mode !== "boxes"} onChange={(boxP) => updateQuantity(key, { boxP })} />
                  <NumberField label="Box M" value={quantity.boxM} disabled={quantity.mode !== "boxes"} onChange={(boxM) => updateQuantity(key, { boxM })} />
                  <label className="flex h-10 min-w-24 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 text-sm font-medium">
                    <Checkbox checked={quantity.mode === "pirex"} onCheckedChange={(checked) => updateQuantity(key, { mode: checked === true ? "pirex" : "boxes", boxP: 0, boxM: 0, pirexQuantity: quantity.pirexQuantity || 1 })} />
                    Pirex
                  </label>
                  <label className="flex h-10 min-w-28 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 text-sm font-medium">
                    <Checkbox checked={quantity.mode === "unit"} onCheckedChange={(checked) => updateQuantity(key, { mode: checked === true ? "unit" : "boxes", boxP: 0, boxM: 0, unitQuantity: quantity.unitQuantity || 1 })} />
                    À unidade
                  </label>
                  <label className="flex h-10 min-w-36 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 text-sm font-medium">
                    <Checkbox checked={quantity.mode === "not_required"} onCheckedChange={(checked) => updateQuantity(key, { mode: checked === true ? "not_required" : "boxes", boxP: 0, boxM: 0 })} />
                    Não necessário
                  </label>
                  {quantity.mode === "pirex" && <NumberField label="Qtd. Pirex" value={quantity.pirexQuantity} onChange={(pirexQuantity) => updateQuantity(key, { pirexQuantity })} />}
                  {quantity.mode === "unit" && <NumberField label="Qtd. unidades" value={quantity.unitQuantity} onChange={(unitQuantity) => updateQuantity(key, { unitQuantity })} />}
                </div>
              </div>;
            })}
          </CardContent>
        </Card>;
      })}
    </div>

    <div className="sticky bottom-[76px] z-20 rounded-2xl border bg-background/95 p-3 shadow-[0_-10px_35px_rgba(0,0,0,.09)] backdrop-blur md:bottom-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PackageCheck className="size-4 text-primary" />
          {dirty ? "Alterações por guardar" : lastSavedAt ? `Guardado em ${updatedLabel(lastSavedAt)}` : "Ainda não guardado"}
        </div>
        <Button size="lg" disabled={pending || !dirty} onClick={save} className="sm:min-w-48">
          {pending ? <LoaderCircle className="animate-spin" /> : <Save />}{pending ? "A guardar…" : "Guardar encomenda"}
        </Button>
      </div>
    </div>
  </div>;
}
