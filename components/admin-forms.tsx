"use client";

import { useActionState, useTransition } from "react";
import { LoaderCircle, Pencil, Plus, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createCategoryAction, createLocationAction, createPickupWindowAction, createProductAction, inviteUserAction, retryNotificationsAction, toggleLocationAction, toggleProductAction, toggleUserAction, updateProductVariationsAction, updateSettingsAction } from "@/app/admin/actions";
import type { Location, OrderingSettings, Product } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ShadcnTimePicker } from "@/components/shadcn-date-time-picker";

const initial = { ok: false as const, message: "" };
function Message({ state }: { state: { ok: boolean; message?: string } }) { return state.message ? <p className={state.ok ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-xl bg-red-50 p-3 text-sm text-red-800"}>{state.message}</p> : null; }

export function InviteUserForm({ locations }: { locations: Location[] }) { const [state, action, pending] = useActionState(inviteUserAction, initial); return <form action={action} className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="invite-name">Nome</Label><Input id="invite-name" name="full_name" required /></div><div><Label htmlFor="invite-email">Email</Label><Input id="invite-email" name="email" type="email" required /></div><div><Label htmlFor="invite-role">Função</Label><NativeSelect id="invite-role" name="role" defaultValue="admin" className="mt-2"><NativeSelectOption value="store">Loja</NativeSelectOption><NativeSelectOption value="kitchen">Cozinha</NativeSelectOption><NativeSelectOption value="admin">Administração</NativeSelectOption></NativeSelect></div><div><Label htmlFor="invite-location">Local</Label><NativeSelect id="invite-location" name="location_id" defaultValue="admin" className="mt-2"><NativeSelectOption value="admin">Sem local (admin)</NativeSelectOption>{locations.map((location) => <NativeSelectOption key={location.id} value={location.id}>{location.name} · {location.kind === "kitchen" ? "cozinha" : "loja"}</NativeSelectOption>)}</NativeSelect></div><div className="md:col-span-2"><Message state={state} /><Button className="mt-3" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}Enviar convite</Button></div></form>; }

export function ToggleButton({ kind, id, active }: { kind: "user" | "location" | "product"; id: string; active: boolean }) { const [pending, start] = useTransition(); return <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const result = kind === "user" ? await toggleUserAction(id, !active) : kind === "location" ? await toggleLocationAction(id, !active) : await toggleProductAction(id, !active); if (result.ok) toast.success(result.message); else toast.error(result.message); })}>{pending && <LoaderCircle className="animate-spin" />}{active ? "Desativar" : "Ativar"}</Button>; }

export function SettingsForm({ settings }: { settings: OrderingSettings }) { const [state, action, pending] = useActionState(updateSettingsAction, initial); return <form action={action} className="grid gap-4 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-xl border p-4"><Switch id="phone-required" name="phone_required" defaultChecked={settings.phone_required} /><Label htmlFor="phone-required" className="font-medium">Telefone obrigatório</Label></div><div className="flex items-center gap-3 rounded-xl border p-4"><Switch id="notes-required" name="general_notes_required" defaultChecked={settings.general_notes_required} /><Label htmlFor="notes-required" className="font-medium">Observações obrigatórias</Label></div><div><Label htmlFor="minimum-lead">Antecedência mínima (minutos)</Label><Input id="minimum-lead" name="minimum_lead_minutes" type="number" min="0" defaultValue={settings.minimum_lead_minutes} /></div><div><Label htmlFor="booking-horizon">Horizonte de reserva (dias)</Label><Input id="booking-horizon" name="booking_horizon_days" type="number" min="1" max="365" defaultValue={settings.booking_horizon_days} /></div><div><Label htmlFor="retention-months">Retenção de dados (meses)</Label><Input id="retention-months" name="retention_months" type="number" min="1" max="120" defaultValue={settings.retention_months} /></div><div className="self-end"><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar definições</Button></div><div className="sm:col-span-2"><Message state={state} /></div></form>; }

export function LocationForm() { const [state, action, pending] = useActionState(createLocationAction, initial); return <form action={action} className="grid gap-3 sm:grid-cols-3"><Input name="name" aria-label="Nome do local" placeholder="Nome do local" required /><Input name="address" aria-label="Morada" placeholder="Morada" required /><NativeSelect name="kind" defaultValue="store" aria-label="Tipo de local"><NativeSelectOption value="store">Loja</NativeSelectOption><NativeSelectOption value="kitchen">Cozinha</NativeSelectOption></NativeSelect><div className="sm:col-span-3"><Message state={state} /><Button className="mt-2" disabled={pending}><Plus />Adicionar local</Button></div></form>; }

const pickupWeekdays = [
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
] as const;

export function WindowForm({ stores }: { stores: Location[] }) {
  const [state, action, pending] = useActionState(createPickupWindowAction, initial);
  return <form action={action} className="grid gap-4 lg:grid-cols-3">
    <div className="flex flex-col gap-2 lg:col-span-3">
      <Label htmlFor="pickup-window-store">Loja</Label>
      <NativeSelect id="pickup-window-store" name="location_id" defaultValue={stores[0]?.id} required><NativeSelectOption value="" disabled>Escolher loja</NativeSelectOption>{stores.map((store) => <NativeSelectOption key={store.id} value={store.id}>{store.name}</NativeSelectOption>)}</NativeSelect>
    </div>
    <fieldset className="flex flex-col gap-2 lg:col-span-3">
      <legend className="text-sm font-medium">Dias da semana</legend>
      <p className="text-sm text-muted-foreground">Selecione um ou mais dias com este horário.</p>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        {pickupWeekdays.map((day) => <div key={day.value} className="flex min-h-11 items-center gap-3 rounded-xl border px-3">
          <Checkbox id={`pickup-weekday-${day.value}`} name="weekdays" value={day.value} defaultChecked={day.value === "1"} />
          <Label htmlFor={`pickup-weekday-${day.value}`} className="cursor-pointer">{day.label}</Label>
        </div>)}
      </div>
    </fieldset>
    <div className="flex flex-col gap-2">
      <Label>Abertura</Label>
      <ShadcnTimePicker name="opens_at" value="10:00" label="Abertura" />
    </div>
    <div className="flex flex-col gap-2">
      <Label>Fecho</Label>
      <ShadcnTimePicker name="closes_at" value="19:00" label="Fecho" />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="pickup-slot-minutes">Intervalo entre escolhas</Label>
      <Input id="pickup-slot-minutes" name="slot_minutes" type="number" defaultValue="30" min="5" max="240" required />
    </div>
    <div className="lg:col-span-3"><Message state={state} /><Button className="mt-2" disabled={pending || !stores.length}><Plus />Adicionar horários</Button></div>
  </form>;
}

export function CategoryForm() { const [state, action, pending] = useActionState(createCategoryAction, initial); return <form action={action} className="flex flex-col gap-3 sm:flex-row"><Input name="name" placeholder="Nova categoria" required /><Button disabled={pending}><Plus />Adicionar</Button><Message state={state} /></form>; }

export function ProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createProductAction, initial);
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <NativeSelect name="category_id" defaultValue={categories[0]?.id} aria-label="Categoria" required><NativeSelectOption value="" disabled>Escolher categoria</NativeSelectOption>{categories.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}</NativeSelect>
    <Input name="name" aria-label="Nome do artigo" placeholder="Nome do artigo" required />
    <Input name="description" aria-label="Descrição" placeholder="Descrição" />
    <Input name="unit_label" aria-label="Unidade" placeholder="Unidade (kg, tab., dose)" required />
    <Input name="minimum_quantity" aria-label="Quantidade mínima" type="number" min="0.001" step="0.001" defaultValue="1" />
    <Input name="quantity_step" aria-label="Incremento" type="number" min="0.001" step="0.001" defaultValue="1" />
    <div className="sm:col-span-2 lg:col-span-3"><Label htmlFor="product-variations">Variações (opcional, uma por linha)</Label><Textarea id="product-variations" name="variations" className="mt-2" placeholder={"Com recheio\nSem recheio"} /></div>
    <div className="flex items-center gap-2"><Switch id="requires-note" name="requires_note" /><Label htmlFor="requires-note">Observação obrigatória</Label></div>
    <div className="sm:col-span-2 lg:col-span-3"><Message state={state} /><Button className="mt-2" disabled={pending}><Plus />Adicionar artigo</Button></div>
  </form>;
}

export function ProductVariationsForm({ product }: { product: Product }) {
  const [state, action, pending] = useActionState(updateProductVariationsAction, initial);
  const fieldId = `product-variations-${product.id}`;
  return <Dialog>
    <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil data-icon="inline-start" />Variações</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Variações · {product.name}</DialogTitle><DialogDescription>Uma opção por linha. Deixe vazio se o artigo não tiver variações.</DialogDescription></DialogHeader>
      <form action={action} className="space-y-4">
        <input type="hidden" name="product_id" value={product.id} />
        <div className="space-y-2"><Label htmlFor={fieldId}>Variações</Label><Textarea id={fieldId} name="variations" defaultValue={product.variations.join("\n")} placeholder={"Com recheio\nSem recheio"} /></div>
        <Message state={state} />
        <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar variações</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function RetryNotificationsButton() { const [pending, start] = useTransition(); return <Button variant="outline" disabled={pending} onClick={() => start(async () => { const result = await retryNotificationsAction(); if (result.ok) toast.success(result.message); else toast.error(result.message); })}>{pending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}Repetir falhadas</Button>; }
