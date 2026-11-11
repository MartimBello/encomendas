"use client";

import { useActionState, useState, useTransition } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { CalendarDays, LoaderCircle, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createSeasonalCampaignAction,
  createSeasonalPickupSlotAction,
  createSeasonalProductAction,
  deleteSeasonalPickupSlotAction,
  deleteSeasonalProductAction,
  toggleSeasonalCampaignAction,
  toggleSeasonalPickupSlotAction,
  toggleSeasonalProductAction,
  updateSeasonalCampaignAction,
  updateSeasonalPickupSlotAction,
  updateSeasonalProductAction,
} from "@/app/admin/actions";
import { APP_TIME_ZONE } from "@/lib/dates";
import type { Location, SeasonalCampaign, SeasonalPickupSlot, SeasonalProduct } from "@/lib/domain";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
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

function formData(values: Record<string, string | number | boolean | null | undefined>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === true) data.set(key, "on");
    else if (value !== false && value !== null && value !== undefined) data.set(key, String(value));
  }
  return data;
}

function showUndoToast(message: string | undefined, undo: () => Promise<{ ok: boolean; message?: string }>) {
  toast.success(message ?? "Alteração guardada.", {
    duration: 8_000,
    action: {
      label: "Desfazer",
      onClick: () => void undo().then((result) => {
        if (result.ok) toast.success("Alteração desfeita.");
        else toast.error(result.message ?? "Não foi possível desfazer a alteração.");
      }).catch(() => toast.error("Não foi possível desfazer a alteração.")),
    },
  });
}

export function SeasonalCampaignCreateDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submit = (data: FormData) => start(async () => {
    setError("");
    const result = await createSeasonalCampaignAction(initial, data);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    toast.success(result.message);
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus data-icon="inline-start" />Nova campanha</Button></DialogTrigger>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Nova campanha sazonal</DialogTitle><DialogDescription>Crie a campanha e configure depois o menu e os dias de levantamento na respetiva página.</DialogDescription></DialogHeader>
      <form action={submit}>
        <FieldGroup className="grid md:grid-cols-2">
          <Field><FieldLabel htmlFor="season-name">Nome</FieldLabel><Input id="season-name" name="name" placeholder="Natal 2026" required /></Field>
          <Field><FieldLabel htmlFor="season-slug">Identificador</FieldLabel><Input id="season-slug" name="slug" placeholder="natal-2026" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></Field>
          <Field className="md:col-span-2"><FieldLabel htmlFor="season-description">Descrição para as lojas</FieldLabel><Textarea id="season-description" name="description" placeholder="Menu e condições desta campanha" /></Field>
          <FieldSet className="rounded-xl border p-4"><FieldLegend>Início da aceitação</FieldLegend><ShadcnDateTimePicker dateName="opens_date" timeName="opens_time" label="Início da aceitação" defaultTime="09:00" /></FieldSet>
          <FieldSet className="rounded-xl border p-4"><FieldLegend>Fim da aceitação</FieldLegend><ShadcnDateTimePicker dateName="closes_date" timeName="closes_time" label="Fim da aceitação" defaultTime="23:45" /></FieldSet>
          {error && <FieldError className="md:col-span-2">{error}</FieldError>}
          <DialogFooter className="md:col-span-2"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Criar campanha</Button></DialogFooter>
        </FieldGroup>
      </form>
    </DialogContent>
  </Dialog>;
}

export function SeasonalCampaignEditForm({ campaign }: { campaign: SeasonalCampaign }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const opensAt = toZonedTime(campaign.ordering_opens_at, APP_TIME_ZONE);
  const closesAt = toZonedTime(campaign.ordering_closes_at, APP_TIME_ZONE);
  const fieldId = `season-edit-${campaign.id}`;
  const submit = (data: FormData) => start(async () => {
    setError("");
    const result = await updateSeasonalCampaignAction(initial, data);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    showUndoToast(result.message, () => updateSeasonalCampaignAction(initial, formData({
      campaign_id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description,
      opens_date: format(opensAt, "yyyy-MM-dd"),
      opens_time: format(opensAt, "HH:mm"),
      closes_date: format(closesAt, "yyyy-MM-dd"),
      closes_time: format(closesAt, "HH:mm"),
    })));
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline">Editar</Button></DialogTrigger>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Editar campanha</DialogTitle><DialogDescription>Atualize o nome, descrição e período de aceitação da campanha.</DialogDescription></DialogHeader>
      <form action={submit} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="campaign_id" value={campaign.id} />
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-name`}>Nome</Label><Input id={`${fieldId}-name`} name="name" defaultValue={campaign.name} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-slug`}>Identificador</Label><Input id={`${fieldId}-slug`} name="slug" defaultValue={campaign.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></div>
        <div className="flex flex-col gap-2 md:col-span-2"><Label htmlFor={`${fieldId}-description`}>Descrição para as lojas</Label><Textarea id={`${fieldId}-description`} name="description" defaultValue={campaign.description} /></div>
        <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Início da aceitação</legend><ShadcnDateTimePicker dateName="opens_date" timeName="opens_time" label="Início da aceitação" defaultDate={opensAt} defaultTime={format(opensAt, "HH:mm")} /></fieldset>
        <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Fim da aceitação</legend><ShadcnDateTimePicker dateName="closes_date" timeName="closes_time" label="Fim da aceitação" defaultDate={closesAt} defaultTime={format(closesAt, "HH:mm")} /></fieldset>
        <div className="md:col-span-2"><Message state={{ ok: false, message: error }} /></div>
        <DialogFooter className="md:col-span-2"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar alterações</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function SeasonalProductForm({ campaignId, categories }: { campaignId: string; categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createSeasonalProductAction, initial);
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <input type="hidden" name="campaign_id" value={campaignId} />
    <div className="flex flex-col gap-2">
      <Label htmlFor="season-product-category">Categoria</Label>
      <NativeSelect id="season-product-category" name="category_id" defaultValue={categories[0]?.id} required><NativeSelectOption value="" disabled>Escolher categoria</NativeSelectOption>{categories.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}</NativeSelect>
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
    <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4"><Label htmlFor="season-product-variations">Variações (opcional, uma por linha)</Label><Textarea id="season-product-variations" name="variations" placeholder={"Com recheio\nSem recheio"} /></div>
    <div className="flex items-center gap-2 rounded-xl border px-3"><Switch id="season-requires-note" name="requires_note" /><Label htmlFor="season-requires-note">Nota obrigatória</Label></div>
    <div className="sm:col-span-2 lg:col-span-4"><Message state={state} /><Button className="mt-2" disabled={pending || !categories.length}><Plus />Adicionar artigo</Button></div>
  </form>;
}

export function SeasonalProductEditForm({ product, categories }: { product: SeasonalProduct; categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fieldId = `season-product-edit-${product.id}`;
  const submit = (data: FormData) => start(async () => {
    setError("");
    const result = await updateSeasonalProductAction(initial, data);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    showUndoToast(result.message, () => updateSeasonalProductAction(initial, formData({
      product_id: product.id,
      category_id: product.category_id ?? "",
      name: product.name,
      description: product.description,
      unit_label: product.unit_label,
      minimum_quantity: product.minimum_quantity,
      quantity_step: product.quantity_step,
      position: product.position,
      stock_limit: product.stock_limit ?? "",
      variations: product.variations.join("\n"),
      requires_note: product.requires_note,
    })));
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil data-icon="inline-start" />Editar</Button></DialogTrigger>
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>Editar artigo · {product.name}</DialogTitle><DialogDescription>Atualize a categoria, quantidades, stock e restantes dados do artigo.</DialogDescription></DialogHeader>
      <form action={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="product_id" value={product.id} />
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-category`}>Categoria</Label><NativeSelect id={`${fieldId}-category`} name="category_id" defaultValue={product.category_id ?? ""} required><NativeSelectOption value="" disabled>Escolher categoria</NativeSelectOption>{categories.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}</NativeSelect></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-name`}>Nome</Label><Input id={`${fieldId}-name`} name="name" defaultValue={product.name} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-description`}>Descrição</Label><Input id={`${fieldId}-description`} name="description" defaultValue={product.description} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-unit`}>Unidade</Label><Input id={`${fieldId}-unit`} name="unit_label" defaultValue={product.unit_label} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-minimum`}>Quantidade mínima</Label><Input id={`${fieldId}-minimum`} name="minimum_quantity" type="number" min="0.001" step="0.001" defaultValue={product.minimum_quantity} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-step`}>Incremento</Label><Input id={`${fieldId}-step`} name="quantity_step" type="number" min="0.001" step="0.001" defaultValue={product.quantity_step} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-position`}>Posição no menu</Label><Input id={`${fieldId}-position`} name="position" type="number" min="0" defaultValue={product.position} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-stock`}>Limite de stock</Label><Input id={`${fieldId}-stock`} name="stock_limit" type="number" min="0.001" step="0.001" defaultValue={product.stock_limit ?? ""} placeholder="Sem limite" /></div>
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3"><Label htmlFor={`${fieldId}-variations`}>Variações (uma por linha)</Label><Textarea id={`${fieldId}-variations`} name="variations" defaultValue={product.variations.join("\n")} placeholder={"Com recheio\nSem recheio"} /></div>
        <div className="flex items-center gap-2 rounded-xl border px-3"><Switch id={`${fieldId}-requires-note`} name="requires_note" defaultChecked={product.requires_note} /><Label htmlFor={`${fieldId}-requires-note`}>Nota obrigatória</Label></div>
        <div className="sm:col-span-2 lg:col-span-3"><Message state={{ ok: false, message: error }} /></div>
        <DialogFooter className="sm:col-span-2 lg:col-span-3"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}Guardar alterações</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function SeasonalPickupSlotForm({ campaignId, stores }: { campaignId: string; stores: Location[] }) {
  const [state, action, pending] = useActionState(createSeasonalPickupSlotAction, initial);
  const [dates, setDates] = useState<Date[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <input type="hidden" name="campaign_id" value={campaignId} />
    <StoreMultiSelect stores={stores} selected={storeIds} onChange={setStoreIds} />
    <div className="sm:col-span-2"><input type="hidden" name="pickup_dates" value={dates.map((date) => format(date, "yyyy-MM-dd")).join(",")} /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start font-normal"><CalendarDays />{dates.length ? `${dates.length} dia${dates.length === 1 ? "" : "s"} selecionado${dates.length === 1 ? "" : "s"}` : "Selecionar vários dias"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="multiple" required={false} selected={dates} onSelect={(selected) => setDates(selected ?? [])} disabled={{ before: new Date() }} /></PopoverContent></Popover>{dates.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{[...dates].sort((a, b) => a.getTime() - b.getTime()).map((date) => format(date, "dd/MM/yyyy")).join(" · ")}</p>}</div>
    <div><Label>Abertura da loja</Label><div className="mt-2"><ShadcnTimePicker name="opens_at" value="09:00" label="Abertura da loja" /></div></div>
    <div><Label>Fecho da loja</Label><div className="mt-2"><ShadcnTimePicker name="closes_at" value="19:00" label="Fecho da loja" /></div></div>
    <div><Label htmlFor="season-slot-minutes">Intervalo entre escolhas</Label><NativeSelect id="season-slot-minutes" name="slot_minutes" defaultValue="30" className="mt-2"><NativeSelectOption value="15">15 minutos</NativeSelectOption><NativeSelectOption value="30">30 minutos</NativeSelectOption><NativeSelectOption value="60">60 minutos</NativeSelectOption></NativeSelect></div>
    <div className="sm:col-span-2 lg:col-span-4"><Message state={state} /><Button className="mt-2" disabled={pending || !stores.length || !dates.length || !storeIds.length}><Plus />Adicionar dias e horário</Button></div>
  </form>;
}

export function SeasonalPickupSlotEditForm({ slot, stores }: { slot: SeasonalPickupSlot; stores: Location[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fieldId = `season-slot-edit-${slot.id}`;
  const submit = (data: FormData) => start(async () => {
    setError("");
    const result = await updateSeasonalPickupSlotAction(initial, data);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    showUndoToast(result.message, () => updateSeasonalPickupSlotAction(initial, formData({
      slot_id: slot.id,
      location_id: slot.location_id,
      pickup_date: slot.pickup_date,
      opens_at: slot.opens_at.slice(0, 5),
      closes_at: slot.closes_at.slice(0, 5),
      slot_minutes: slot.slot_minutes,
    })));
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil data-icon="inline-start" />Editar</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Editar dia de levantamento</DialogTitle><DialogDescription>Atualize a loja, data, período de abertura e intervalo entre escolhas.</DialogDescription></DialogHeader>
      <form action={submit} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="slot_id" value={slot.id} />
        <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor={`${fieldId}-location`}>Loja</Label><NativeSelect id={`${fieldId}-location`} name="location_id" defaultValue={slot.location_id} required>{stores.map((store) => <NativeSelectOption key={store.id} value={store.id}>{store.name}</NativeSelectOption>)}</NativeSelect></div>
        <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor={`${fieldId}-date`}>Data</Label><Input id={`${fieldId}-date`} name="pickup_date" type="date" defaultValue={slot.pickup_date} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-opens`}>Abertura da loja</Label><Input id={`${fieldId}-opens`} name="opens_at" type="time" defaultValue={slot.opens_at.slice(0, 5)} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-closes`}>Fecho da loja</Label><Input id={`${fieldId}-closes`} name="closes_at" type="time" defaultValue={slot.closes_at.slice(0, 5)} required /></div>
        <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor={`${fieldId}-minutes`}>Intervalo entre escolhas</Label><NativeSelect id={`${fieldId}-minutes`} name="slot_minutes" defaultValue={String(slot.slot_minutes)}><NativeSelectOption value="15">15 minutos</NativeSelectOption><NativeSelectOption value="30">30 minutos</NativeSelectOption><NativeSelectOption value="60">60 minutos</NativeSelectOption></NativeSelect></div>
        <div className="sm:col-span-2"><Message state={{ ok: false, message: error }} /></div>
        <DialogFooter className="sm:col-span-2"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}Guardar alterações</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function SeasonalDeleteButton({ kind, id, name }: { kind: "product" | "slot"; id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const product = kind === "product";
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 data-icon="inline-start" />Remover</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Remover {product ? "artigo" : "dia de levantamento"}?</AlertDialogTitle>
        <AlertDialogDescription>{product ? `O artigo “${name}” deixa de estar disponível no menu. As encomendas existentes mantêm o nome e a quantidade registados.` : `O horário “${name}” deixa de estar disponível para novas encomendas. As encomendas já registadas mantêm o levantamento escolhido.`}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); start(async () => {
          const result = product ? await deleteSeasonalProductAction(id) : await deleteSeasonalPickupSlotAction(id);
          if (result.ok) { toast.success(result.message); setOpen(false); } else toast.error(result.message);
        }); }}>{pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}Remover definitivamente</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
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
