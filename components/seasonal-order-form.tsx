"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LoaderCircle, Minus, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { createSeasonalOrderAction, reviseSeasonalOrderAction } from "@/app/orders/actions";
import type { OrderRevision, OrderingSettings, SeasonalCampaign } from "@/lib/domain";
import { APP_TIME_ZONE } from "@/lib/dates";
import { formatQuantity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SelectedItem = { quantity: number; note: string };

function itemKey(productId: string, variation = "") { return `${productId}\u0000${variation}`; }

function initialItems(initial?: OrderRevision) {
  return Object.fromEntries((initial?.items ?? []).flatMap((item) => item.seasonal_product_id ? [[itemKey(item.seasonal_product_id, item.variation_name || ""), { quantity: Number(item.quantity), note: item.item_note || "" }]] : [])) as Record<string, SelectedItem>;
}

export function SeasonalOrderForm({ campaign, settings, orderId, initial }: { campaign: SeasonalCampaign; settings: OrderingSettings; orderId?: string; initial?: OrderRevision }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const products = (campaign.products ?? []).filter((product) => product.active).sort((a, b) => (a.category?.position ?? Number.MAX_SAFE_INTEGER) - (b.category?.position ?? Number.MAX_SAFE_INTEGER) || a.position - b.position);
  const productChoices = products.flatMap((product) => (product.variations.length ? product.variations : [""]).map((variation) => ({ product, variation, key: itemKey(product.id, variation) })));
  const productGroups = [...new Map(productChoices.map((choice) => {
    const name = choice.product.category?.name ?? "Outros";
    return [name, { name, choices: productChoices.filter((entry) => (entry.product.category?.name ?? "Outros") === name) }];
  })).values()];
  const slots = (campaign.pickup_slots ?? []).filter((slot) => slot.active && slot.pickup_date >= new Date().toLocaleDateString("sv-SE", { timeZone: APP_TIME_ZONE })).sort((a, b) => a.pickup_date.localeCompare(b.pickup_date) || a.opens_at.localeCompare(b.opens_at));
  const initialDateKey = initial?.pickup_at ? formatInTimeZone(initial.pickup_at, APP_TIME_ZONE, "yyyy-MM-dd") : "";
  const initialTime = initial?.pickup_at ? formatInTimeZone(initial.pickup_at, APP_TIME_ZONE, "HH:mm") : "";
  const initialWindow = slots.find((slot) => slot.pickup_date === initialDateKey && slot.location_id === initial?.pickup_store_id && initialTime >= slot.opens_at.slice(0, 5) && initialTime < slot.closes_at.slice(0, 5));
  const [items, setItems] = useState<Record<string, SelectedItem>>(() => initialItems(initial));
  const [pickupDate, setPickupDate] = useState<Date | undefined>(() => initialDateKey ? new Date(`${initialDateKey}T12:00:00`) : undefined);
  const [pickupWindowId, setPickupWindowId] = useState(initialWindow?.id ?? "");
  const [pickupAt, setPickupAt] = useState(initial?.pickup_at ?? "");
  const idempotencyKey = useRef<string | null>(null);
  const selectedDateKey = pickupDate ? format(pickupDate, "yyyy-MM-dd") : "";
  const availableDates = new Set(slots.map((slot) => slot.pickup_date));
  const dateWindows = slots.filter((slot) => slot.pickup_date === selectedDateKey);
  const selectedWindow = slots.find((slot) => slot.id === pickupWindowId);
  const pickupTimes = selectedWindow ? buildPickupTimes(selectedWindow.pickup_date, selectedWindow.opens_at, selectedWindow.closes_at, selectedWindow.slot_minutes) : [];

  function changeQuantity(key: string, minimum: number, step: number, direction: 1 | -1) {
    setItems((current) => {
      const existing = current[key]?.quantity ?? 0;
      const quantity = direction === 1 ? (existing === 0 ? minimum : existing + step) : existing <= minimum ? 0 : Math.max(minimum, existing - step);
      return { ...current, [key]: { quantity: Number(quantity.toFixed(3)), note: current[key]?.note ?? "" } };
    });
  }

  function submit(formData: FormData) {
    const selected = productChoices.flatMap(({ product, variation, key }) => {
      const item = items[key];
      return item?.quantity > 0 ? [{ product_id: product.id, variation, quantity: item.quantity, note: item.note }] : [];
    });
    if (!selected.length) { toast.error("Adicione pelo menos um artigo do menu especial."); return; }
    idempotencyKey.current ??= crypto.randomUUID();
    startTransition(async () => {
      const payload = {
        idempotency_key: idempotencyKey.current!, order_id: orderId, campaign_id: campaign.id,
        customer_name: String(formData.get("customer_name") ?? ""), customer_email: String(formData.get("customer_email") ?? ""),
        customer_phone: String(formData.get("customer_phone") ?? ""), pickup_slot_id: String(formData.get("pickup_slot_id") ?? ""),
        pickup_at: String(formData.get("pickup_at") ?? ""),
        general_notes: String(formData.get("general_notes") ?? ""), items: selected,
      };
      const result = orderId ? await reviseSeasonalOrderAction(payload) : await createSeasonalOrderAction(payload);
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(result.message); router.push(`/loja/encomendas/${result.data?.orderId}`); router.refresh();
    });
  }

  return <form action={submit} className="space-y-5">
    <Card><CardHeader><CardTitle>Cliente e levantamento</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <div><Label htmlFor="season-customer-name">Nome do cliente *</Label><Input id="season-customer-name" name="customer_name" autoComplete="name" defaultValue={initial?.customer_name ?? ""} required /></div>
      <div><Label htmlFor="season-customer-email">Email (opcional)</Label><Input id="season-customer-email" name="customer_email" type="email" inputMode="email" autoComplete="email" defaultValue={initial?.customer_email ?? ""} /></div>
      <div><Label htmlFor="season-customer-phone">Telefone {settings.phone_required ? "*" : ""}</Label><Input id="season-customer-phone" name="customer_phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={initial?.customer_phone ?? ""} required={settings.phone_required} /></div>
      <div><Label>Data de levantamento *</Label><Popover><PopoverTrigger asChild><Button type="button" variant="outline" aria-label="Data de levantamento" className="mt-2 w-full justify-start font-normal"><CalendarDays />{pickupDate ? format(pickupDate, "PPP", { locale: pt }) : "Escolher data"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={pickupDate} onSelect={(date) => { setPickupDate(date); setPickupWindowId(""); setPickupAt(""); }} disabled={(date) => !availableDates.has(format(date, "yyyy-MM-dd"))} /></PopoverContent></Popover></div>
      <div><Label>Loja de levantamento *</Label><input type="hidden" name="pickup_slot_id" value={pickupWindowId} /><Select value={pickupWindowId} onValueChange={(value) => { setPickupWindowId(value); setPickupAt(""); }} disabled={!pickupDate}><SelectTrigger aria-label="Loja de levantamento" className="mt-2"><SelectValue placeholder="Escolher loja" /></SelectTrigger><SelectContent>{dateWindows.map((slot) => <SelectItem key={slot.id} value={slot.id}>{slot.location?.name} · {slot.opens_at.slice(0, 5)}–{slot.closes_at.slice(0, 5)}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Hora de levantamento *</Label><input type="hidden" name="pickup_at" value={pickupAt} /><Select value={pickupAt} onValueChange={setPickupAt} disabled={!selectedWindow}><SelectTrigger aria-label="Hora de levantamento" className="mt-2"><SelectValue placeholder="Escolher hora" /></SelectTrigger><SelectContent>{pickupTimes.map((time) => <SelectItem key={time.value} value={time.value}>{time.label}</SelectItem>)}</SelectContent></Select></div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Menu especial · {campaign.name}</CardTitle></CardHeader><CardContent className="flex flex-col gap-6">
      {productGroups.map((group) => <section key={group.name} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{group.name}</h3>
        <div className="grid gap-4 lg:grid-cols-2">{group.choices.map(({ product, variation, key }, choiceIndex) => {
          const selected = items[key] ?? { quantity: 0, note: "" };
          const choiceName = `${product.name}${variation ? ` · ${variation}` : ""}`;
          return <article key={key} className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4"><div><h4 className="font-semibold">{product.name}</h4>{variation && <p className="mt-1 font-medium text-primary">{variation}</p>}{product.description && <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>}<p className="mt-2 text-xs text-muted-foreground">Mínimo {formatQuantity(product.minimum_quantity)} · incrementos de {formatQuantity(product.quantity_step)} {product.unit_label}{product.stock_limit !== null ? ` · stock limitado a ${formatQuantity(product.stock_limit)}` : ""}</p></div><div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label={`Retirar ${choiceName}`} onClick={() => changeQuantity(key, product.minimum_quantity, product.quantity_step, -1)}><Minus /></Button><span className="min-w-16 text-center font-semibold">{formatQuantity(selected.quantity)} {product.unit_label}</span><Button type="button" size="icon" aria-label={`Adicionar ${choiceName}`} onClick={() => changeQuantity(key, product.minimum_quantity, product.quantity_step, 1)}><Plus /></Button></div></div>
            {selected.quantity > 0 && <div className="mt-4"><Label htmlFor={`season-note-${product.id}-${choiceIndex}`}>Observação {product.requires_note ? "*" : ""}</Label><Input id={`season-note-${product.id}-${choiceIndex}`} value={selected.note} required={product.requires_note} onChange={(event) => setItems((current) => ({ ...current, [key]: { ...selected, note: event.target.value } }))} placeholder="Preparação, corte ou outra indicação" /></div>}
          </article>;
        })}</div>
      </section>)}
      {!products.length && <p className="text-sm text-muted-foreground">Esta campanha ainda não tem artigos disponíveis.</p>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Observações gerais</CardTitle></CardHeader><CardContent><Label htmlFor="season-general-notes">Notas {settings.general_notes_required ? "*" : ""}</Label><Textarea id="season-general-notes" name="general_notes" defaultValue={initial?.general_notes ?? ""} required={settings.general_notes_required} maxLength={2000} /></CardContent></Card>
    <Button size="lg" className="w-full sm:w-auto" disabled={pending || !products.length || !slots.length || !pickupWindowId || !pickupAt}>{pending ? <LoaderCircle className="animate-spin" /> : <Send />}{orderId ? "Guardar alterações" : "Enviar encomenda sazonal"}</Button>
  </form>;
}

function buildPickupTimes(date: string, opensAt: string, closesAt: string, step: number) {
  const [openHour, openMinute] = opensAt.split(":").map(Number); const [closeHour, closeMinute] = closesAt.split(":").map(Number);
  const result: { value: string; label: string }[] = [];
  for (let minutes = openHour * 60 + openMinute; minutes < closeHour * 60 + closeMinute; minutes += step) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const utc = fromZonedTime(`${date}T${time}:00`, APP_TIME_ZONE);
    if (utc > new Date()) result.push({ value: utc.toISOString(), label: time });
  }
  return result;
}
