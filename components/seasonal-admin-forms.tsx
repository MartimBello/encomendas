"use client";

import { useActionState, useState, useTransition } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { CalendarDays, LoaderCircle, Plus, Store } from "lucide-react";
import { toast } from "sonner";
import {
  createSeasonalCampaignAction,
  createSeasonalPickupSlotAction,
  createSeasonalProductAction,
  toggleSeasonalCampaignAction,
  toggleSeasonalPickupSlotAction,
  toggleSeasonalProductAction,
  updateSeasonalCampaignAction,
  updateSeasonalProductStockAction,
} from "@/app/admin/actions";
import { APP_TIME_ZONE } from "@/lib/dates";
import type { Location, SeasonalCampaign, SeasonalProduct } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ShadcnDateTimePicker, ShadcnTimePicker } from "@/components/shadcn-date-time-picker";

const initial = { ok: false as const, message: "" };

function Message({ state }: { state: { ok: boolean; message?: string } }) {
  return state.message ? <p className={state.ok ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-xl bg-red-50 p-3 text-sm text-red-800"}>{state.message}</p> : null;
}

export function SeasonalCampaignForm() {
  const [state, action, pending] = useActionState(createSeasonalCampaignAction, initial);
  return <form action={action} className="grid gap-4 md:grid-cols-2">
    <div><Label htmlFor="season-name">Nome</Label><Input id="season-name" name="name" placeholder="Natal 2026" required /></div>
    <div><Label htmlFor="season-slug">Identificador</Label><Input id="season-slug" name="slug" placeholder="natal-2026" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></div>
    <div className="md:col-span-2"><Label htmlFor="season-description">Descrição para as lojas</Label><Textarea id="season-description" name="description" placeholder="Menu e condições desta campanha" /></div>
    <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Início da aceitação</legend><ShadcnDateTimePicker dateName="opens_date" timeName="opens_time" label="Início da aceitação" defaultTime="09:00" /></fieldset>
    <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Fim da aceitação</legend><ShadcnDateTimePicker dateName="closes_date" timeName="closes_time" label="Fim da aceitação" defaultTime="23:45" /></fieldset>
    <div className="md:col-span-2"><Message state={state} /><Button className="mt-3" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Plus />}Criar campanha</Button></div>
  </form>;
}

export function SeasonalCampaignEditForm({ campaign }: { campaign: SeasonalCampaign }) {
  const [state, action, pending] = useActionState(updateSeasonalCampaignAction, initial);
  const opensAt = toZonedTime(campaign.ordering_opens_at, APP_TIME_ZONE);
  const closesAt = toZonedTime(campaign.ordering_closes_at, APP_TIME_ZONE);
  const fieldId = `season-edit-${campaign.id}`;
  return <Dialog>
    <DialogTrigger asChild><Button size="sm" variant="outline">Editar</Button></DialogTrigger>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Editar campanha</DialogTitle><DialogDescription>Atualize o nome, descrição e período de aceitação da campanha.</DialogDescription></DialogHeader>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="campaign_id" value={campaign.id} />
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-name`}>Nome</Label><Input id={`${fieldId}-name`} name="name" defaultValue={campaign.name} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-slug`}>Identificador</Label><Input id={`${fieldId}-slug`} name="slug" defaultValue={campaign.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></div>
        <div className="flex flex-col gap-2 md:col-span-2"><Label htmlFor={`${fieldId}-description`}>Descrição para as lojas</Label><Textarea id={`${fieldId}-description`} name="description" defaultValue={campaign.description} /></div>
        <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Início da aceitação</legend><ShadcnDateTimePicker dateName="opens_date" timeName="opens_time" label="Início da aceitação" defaultDate={opensAt} defaultTime={format(opensAt, "HH:mm")} /></fieldset>
        <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Fim da aceitação</legend><ShadcnDateTimePicker dateName="closes_date" timeName="closes_time" label="Fim da aceitação" defaultDate={closesAt} defaultTime={format(closesAt, "HH:mm")} /></fieldset>
        <div className="md:col-span-2"><Message state={state} /></div>
        <DialogFooter className="md:col-span-2"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar alterações</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function SeasonalProductForm({ campaigns }: { campaigns: SeasonalCampaign[] }) {
  const [state, action, pending] = useActionState(createSeasonalProductAction, initial);
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-campaign">Campanha</Label>
      <NativeSelect id="season-product-campaign" name="campaign_id" defaultValue={campaigns[0]?.id} required><NativeSelectOption value="" disabled>Escolher campanha</NativeSelectOption>{campaigns.map((campaign) => <NativeSelectOption key={campaign.id} value={campaign.id}>{campaign.name}</NativeSelectOption>)}</NativeSelect>
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-name">Nome do artigo</Label>
      <Input id="season-product-name" name="name" placeholder="Nome do artigo" required />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-description">Descrição</Label>
      <Input id="season-product-description" name="description" placeholder="Descrição" />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-unit">Unidade</Label>
      <Input id="season-product-unit" name="unit_label" placeholder="kg, dose…" required />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-minimum">Quantidade mínima</Label>
      <Input id="season-product-minimum" name="minimum_quantity" type="number" min="0.001" step="0.001" defaultValue="1" required />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-step">Incremento da quantidade</Label>
      <Input id="season-product-step" name="quantity_step" type="number" min="0.001" step="0.001" defaultValue="1" required />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-position">Posição no menu</Label>
      <Input id="season-product-position" name="position" type="number" min="0" defaultValue="0" required />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-stock">Limite de stock</Label>
      <Input id="season-product-stock" name="stock_limit" type="number" min="0.001" step="0.001" placeholder="Sem limite" />
    </div>
    <div className="flex items-center gap-2 rounded-xl border px-3"><Switch id="season-requires-note" name="requires_note" /><Label htmlFor="season-requires-note">Nota obrigatória</Label></div>
    <div className="sm:col-span-2 lg:col-span-4"><Message state={state} /><Button className="mt-2" disabled={pending || !campaigns.length}><Plus />Adicionar artigo</Button></div>
  </form>;
}

export function SeasonalProductStockForm({ product }: { product: SeasonalProduct }) {
  const [state, action, pending] = useActionState(updateSeasonalProductStockAction, initial);
  return <Dialog>
    <DialogTrigger asChild><Button size="sm" variant="outline">Stock</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Limite de stock · {product.name}</DialogTitle><DialogDescription>O limite inclui encomendas pendentes e aceites. Rejeições e cancelamentos libertam automaticamente a quantidade.</DialogDescription></DialogHeader>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="product_id" value={product.id} />
        <div className="flex flex-col gap-2"><Label htmlFor={`season-stock-${product.id}`}>Quantidade máxima</Label><Input id={`season-stock-${product.id}`} name="stock_limit" type="number" min="0.001" step="0.001" defaultValue={product.stock_limit ?? ""} placeholder="Sem limite" /><p className="text-sm text-muted-foreground">Deixe vazio para permitir stock ilimitado.</p></div>
        <Message state={state} />
        <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar stock</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function SeasonalPickupSlotForm({ campaigns, stores }: { campaigns: SeasonalCampaign[]; stores: Location[] }) {
  const [state, action, pending] = useActionState(createSeasonalPickupSlotAction, initial);
  const [dates, setDates] = useState<Date[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <NativeSelect name="campaign_id" defaultValue={campaigns[0]?.id} aria-label="Campanha" required><NativeSelectOption value="" disabled>Escolher campanha</NativeSelectOption>{campaigns.map((campaign) => <NativeSelectOption key={campaign.id} value={campaign.id}>{campaign.name}</NativeSelectOption>)}</NativeSelect>
    <StoreMultiSelect stores={stores} selected={storeIds} onChange={setStoreIds} />
    <div className="sm:col-span-2"><input type="hidden" name="pickup_dates" value={dates.map((date) => format(date, "yyyy-MM-dd")).join(",")} /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start font-normal"><CalendarDays />{dates.length ? `${dates.length} dia${dates.length === 1 ? "" : "s"} selecionado${dates.length === 1 ? "" : "s"}` : "Selecionar vários dias"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="multiple" required={false} selected={dates} onSelect={(selected) => setDates(selected ?? [])} disabled={{ before: new Date() }} /></PopoverContent></Popover>{dates.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{[...dates].sort((a, b) => a.getTime() - b.getTime()).map((date) => format(date, "dd/MM/yyyy")).join(" · ")}</p>}</div>
    <div><Label>Abertura da loja</Label><div className="mt-2"><ShadcnTimePicker name="opens_at" value="09:00" label="Abertura da loja" /></div></div>
    <div><Label>Fecho da loja</Label><div className="mt-2"><ShadcnTimePicker name="closes_at" value="19:00" label="Fecho da loja" /></div></div>
    <div><Label htmlFor="season-slot-minutes">Intervalo entre escolhas</Label><NativeSelect id="season-slot-minutes" name="slot_minutes" defaultValue="30" className="mt-2"><NativeSelectOption value="15">15 minutos</NativeSelectOption><NativeSelectOption value="30">30 minutos</NativeSelectOption><NativeSelectOption value="60">60 minutos</NativeSelectOption></NativeSelect></div>
    <div className="sm:col-span-2 lg:col-span-4"><Message state={state} /><Button className="mt-2" disabled={pending || !campaigns.length || !stores.length || !dates.length || !storeIds.length}><Plus />Adicionar dias e horário</Button></div>
  </form>;
}

function StoreMultiSelect({ stores, selected, onChange }: { stores: Location[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
  return <div><input type="hidden" name="location_ids" value={selected.join(",")} /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start font-normal"><Store />{selected.length ? `${selected.length} loja${selected.length === 1 ? "" : "s"} selecionada${selected.length === 1 ? "" : "s"}` : "Selecionar lojas"}</Button></PopoverTrigger><PopoverContent className="w-80 space-y-1 p-2" align="start">{stores.map((store) => <label key={store.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 hover:bg-muted"><Checkbox checked={selected.includes(store.id)} onCheckedChange={() => toggle(store.id)} /><span className="text-sm font-medium">{store.name}</span></label>)}</PopoverContent></Popover></div>;
}

export function SeasonalToggleButton({ kind, id, active }: { kind: "campaign" | "product" | "slot"; id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
    const result = kind === "campaign" ? await toggleSeasonalCampaignAction(id, !active) : kind === "product" ? await toggleSeasonalProductAction(id, !active) : await toggleSeasonalPickupSlotAction(id, !active);
    if (result.ok) toast.success(result.message); else toast.error(result.message);
  })}>{pending && <LoaderCircle className="animate-spin" />}{active ? "Desativar" : kind === "campaign" ? "Publicar" : "Ativar"}</Button>;
}
