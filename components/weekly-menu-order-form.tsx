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
  boxP: number;
  boxM: number;
  pirex: boolean;
  pirexQuantity: number;
};

const EMPTY_QUANTITY: QuantityState = { boxP: 0, boxM: 0, pirex: false, pirexQuantity: 1 };

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
      boxP: item.box_p_quantity,
      boxM: item.box_m_quantity,
      pirex: item.pirex_quantity !== null,
      pirexQuantity: item.pirex_quantity ?? 1,
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
  const summary = Object.values(quantities).reduce((total, item) => ({
    dishes: total.dishes + ((item.pirex ? item.pirexQuantity > 0 : item.boxP > 0 || item.boxM > 0) ? 1 : 0),
    boxes: total.boxes + (item.pirex ? 0 : item.boxP + item.boxM),
    pirex: total.pirex + (item.pirex ? item.pirexQuantity : 0),
  }), { dishes: 0, boxes: 0, pirex: 0 });

  const save = () => startTransition(async () => {
    const items = [];
    for (const day of menu.dias) {
      for (const category of menu.categorias) {
        for (const dishName of day.pratos[category.key] ?? []) {
          const quantity = quantities[itemKey(day.dia, category.key, dishName)] ?? EMPTY_QUANTITY;
          if (quantity.pirex && quantity.pirexQuantity > 0) {
            items.push({ day_key: day.dia, category_key: category.key, dish_name: dishName, box_p_quantity: 0, box_m_quantity: 0, pirex_quantity: quantity.pirexQuantity });
          } else if (!quantity.pirex && (quantity.boxP > 0 || quantity.boxM > 0)) {
            items.push({ day_key: day.dia, category_key: category.key, dish_name: dishName, box_p_quantity: quantity.boxP, box_m_quantity: quantity.boxM, pirex_quantity: null });
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
          <Badge variant="secondary">{summary.dishes} pratos</Badge>
          <Badge variant="outline">{summary.boxes} caixas</Badge>
          <Badge variant="outline">{summary.pirex} Pirex</Badge>
        </div>
      </CardContent>
    </Card>

    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2" role="tablist" aria-label="Dias da ementa">
        {menu.dias.map((day, index) => {
          const ordered = menu.categorias.some((category) => (day.pratos[category.key] ?? []).some((dishName) => {
            const value = quantities[itemKey(day.dia, category.key, dishName)];
            return value && (value.pirex ? value.pirexQuantity > 0 : value.boxP > 0 || value.boxM > 0);
          }));
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
            {ordered && <span className={cn("absolute right-2 top-2 grid size-4 place-items-center rounded-full", selectedDay === index ? "bg-white text-primary" : "bg-primary text-white")}><Check className="size-3" /></span>}
          </button>;
        })}
      </div>
    </div>

    <div role="tabpanel" className="space-y-4">
      <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">{selected.diaLabel}</h2><p className="text-sm text-muted-foreground">{dateForDay(menu.dataReferencia, selectedDay)}</p></div><p className="hidden text-xs text-muted-foreground sm:block">Escolha caixas P e M ou ative Pirex</p></div>
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
                  <NumberField label="Box P" value={quantity.boxP} disabled={quantity.pirex} onChange={(boxP) => updateQuantity(key, { boxP })} />
                  <NumberField label="Box M" value={quantity.boxM} disabled={quantity.pirex} onChange={(boxM) => updateQuantity(key, { boxM })} />
                  <label className="flex h-10 min-w-24 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 text-sm font-medium">
                    <Checkbox checked={quantity.pirex} onCheckedChange={(checked) => updateQuantity(key, { pirex: checked === true, boxP: 0, boxM: 0, pirexQuantity: quantity.pirexQuantity || 1 })} />
                    Pirex
                  </label>
                  {quantity.pirex && <NumberField label="Qtd. Pirex" value={quantity.pirexQuantity} onChange={(pirexQuantity) => updateQuantity(key, { pirexQuantity })} />}
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
