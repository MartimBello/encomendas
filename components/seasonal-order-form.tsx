"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LoaderCircle, Minus, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { fromZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { createSeasonalOrderAction } from "@/app/orders/actions";
import type { OrderingSettings, SeasonalCampaign } from "@/lib/domain";
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

export function SeasonalOrderForm({ campaign, settings }: { campaign: SeasonalCampaign; settings: OrderingSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<Record<string, SelectedItem>>({});
  const [pickupDate, setPickupDate] = useState<Date>();
  const [pickupWindowId, setPickupWindowId] = useState("");
  const [pickupAt, setPickupAt] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const products = (campaign.products ?? []).filter((product) => product.active).sort((a, b) => a.position - b.position);
  const slots = (campaign.pickup_slots ?? []).filter((slot) => slot.active && slot.pickup_date >= new Date().toLocaleDateString("sv-SE", { timeZone: APP_TIME_ZONE })).sort((a, b) => a.pickup_date.localeCompare(b.pickup_date) || a.opens_at.localeCompare(b.opens_at));
  const selectedDateKey = pickupDate ? format(pickupDate, "yyyy-MM-dd") : "";
  const availableDates = new Set(slots.map((slot) => slot.pickup_date));
  const dateWindows = slots.filter((slot) => slot.pickup_date === selectedDateKey);
  const selectedWindow = slots.find((slot) => slot.id === pickupWindowId);
  const pickupTimes = selectedWindow ? buildPickupTimes(selectedWindow.pickup_date, selectedWindow.opens_at, selectedWindow.closes_at, selectedWindow.slot_minutes) : [];

  function changeQuantity(productId: string, minimum: number, step: number, direction: 1 | -1) {
    setItems((current) => {
      const existing = current[productId]?.quantity ?? 0;
      const quantity = direction === 1 ? (existing === 0 ? minimum : existing + step) : existing <= minimum ? 0 : Math.max(minimum, existing - step);
      return { ...current, [productId]: { quantity: Number(quantity.toFixed(3)), note: current[productId]?.note ?? "" } };
    });
  }

  function submit(formData: FormData) {
    const selected = products.flatMap((product) => {
      const item = items[product.id];
      return item?.quantity > 0 ? [{ product_id: product.id, quantity: item.quantity, note: item.note }] : [];
    });
    if (!selected.length) { toast.error("Adicione pelo menos um artigo do menu especial."); return; }
    idempotencyKey.current ??= crypto.randomUUID();
    startTransition(async () => {
      const result = await createSeasonalOrderAction({
        idempotency_key: idempotencyKey.current!, campaign_id: campaign.id,
        customer_name: String(formData.get("customer_name") ?? ""), customer_email: String(formData.get("customer_email") ?? ""),
        customer_phone: String(formData.get("customer_phone") ?? ""), pickup_slot_id: String(formData.get("pickup_slot_id") ?? ""),
        pickup_at: String(formData.get("pickup_at") ?? ""),
        general_notes: String(formData.get("general_notes") ?? ""), items: selected,
      });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(result.message); router.push(`/loja/encomendas/${result.data?.orderId}`); router.refresh();
    });
  }

  return <form action={submit} className="space-y-5">
    <Card><CardHeader><CardTitle>Cliente e levantamento</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <div><Label htmlFor="season-customer-name">Nome do cliente *</Label><Input id="season-customer-name" name="customer_name" autoComplete="name" required /></div>
      <div><Label htmlFor="season-customer-email">Email *</Label><Input id="season-customer-email" name="customer_email" type="email" inputMode="email" autoComplete="email" required /></div>
      <div><Label htmlFor="season-customer-phone">Telefone {settings.phone_required ? "*" : ""}</Label><Input id="season-customer-phone" name="customer_phone" type="tel" inputMode="tel" autoComplete="tel" required={settings.phone_required} /></div>
      <div><Label>Data de levantamento *</Label><Popover><PopoverTrigger asChild><Button type="button" variant="outline" aria-label="Data de levantamento" className="mt-2 w-full justify-start font-normal"><CalendarDays />{pickupDate ? format(pickupDate, "PPP", { locale: pt }) : "Escolher data"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={pickupDate} onSelect={(date) => { setPickupDate(date); setPickupWindowId(""); setPickupAt(""); }} disabled={(date) => !availableDates.has(format(date, "yyyy-MM-dd"))} /></PopoverContent></Popover></div>
      <div><Label>Loja de levantamento *</Label><input type="hidden" name="pickup_slot_id" value={pickupWindowId} /><Select value={pickupWindowId} onValueChange={(value) => { setPickupWindowId(value); setPickupAt(""); }} disabled={!pickupDate}><SelectTrigger aria-label="Loja de levantamento" className="mt-2"><SelectValue placeholder="Escolher loja" /></SelectTrigger><SelectContent>{dateWindows.map((slot) => <SelectItem key={slot.id} value={slot.id}>{slot.location?.name} · {slot.opens_at.slice(0, 5)}–{slot.closes_at.slice(0, 5)}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Hora de levantamento *</Label><input type="hidden" name="pickup_at" value={pickupAt} /><Select value={pickupAt} onValueChange={setPickupAt} disabled={!selectedWindow}><SelectTrigger aria-label="Hora de levantamento" className="mt-2"><SelectValue placeholder="Escolher hora" /></SelectTrigger><SelectContent>{pickupTimes.map((time) => <SelectItem key={time.value} value={time.value}>{time.label}</SelectItem>)}</SelectContent></Select></div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Menu especial · {campaign.name}</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2">
      {products.map((product) => {
        const selected = items[product.id] ?? { quantity: 0, note: "" };
        return <article key={product.id} className="rounded-xl border p-4">
          <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{product.name}</h3>{product.description && <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>}<p className="mt-2 text-xs text-muted-foreground">Mínimo {formatQuantity(product.minimum_quantity)} · incrementos de {formatQuantity(product.quantity_step)} {product.unit_label}</p></div><div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label={`Retirar ${product.name}`} onClick={() => changeQuantity(product.id, product.minimum_quantity, product.quantity_step, -1)}><Minus /></Button><span className="min-w-16 text-center font-semibold">{formatQuantity(selected.quantity)} {product.unit_label}</span><Button type="button" size="icon" aria-label={`Adicionar ${product.name}`} onClick={() => changeQuantity(product.id, product.minimum_quantity, product.quantity_step, 1)}><Plus /></Button></div></div>
          {selected.quantity > 0 && <div className="mt-4"><Label htmlFor={`season-note-${product.id}`}>Observação {product.requires_note ? "*" : ""}</Label><Input id={`season-note-${product.id}`} value={selected.note} required={product.requires_note} onChange={(event) => setItems((current) => ({ ...current, [product.id]: { ...selected, note: event.target.value } }))} placeholder="Preparação, corte ou outra indicação" /></div>}
        </article>;
      })}
      {!products.length && <p className="text-sm text-muted-foreground">Esta campanha ainda não tem artigos disponíveis.</p>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Observações gerais</CardTitle></CardHeader><CardContent><Label htmlFor="season-general-notes">Notas {settings.general_notes_required ? "*" : ""}</Label><Textarea id="season-general-notes" name="general_notes" required={settings.general_notes_required} maxLength={2000} /></CardContent></Card>
    <Button size="lg" className="w-full sm:w-auto" disabled={pending || !products.length || !slots.length || !pickupWindowId || !pickupAt}>{pending ? <LoaderCircle className="animate-spin" /> : <Send />}Enviar encomenda sazonal</Button>
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
