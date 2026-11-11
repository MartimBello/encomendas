"use client";

import { useActionState, useId, useMemo, useState, useTransition } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, LoaderCircle, Pencil, Plus, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createCategoryAction, createLocationAction, createPickupWindowAction, createProductAction, inviteUserAction, reorderCategoriesAction, retryNotificationsAction, toggleLocationAction, toggleProductAction, toggleUserAction, updateCategoryAction, updateOrderingRulesAction, updateProductAction, updateRetentionSettingsAction } from "@/app/admin/actions";
import type { Location, OrderingSettings, Product } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ShadcnTimePicker } from "@/components/shadcn-date-time-picker";

const initial = { ok: false as const, message: "" };
function Message({ state }: { state: { ok: boolean; message?: string } }) { return state.message ? <p className={state.ok ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-xl bg-red-50 p-3 text-sm text-red-800"}>{state.message}</p> : null; }

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

export function InviteUserForm({ locations }: { locations: Location[] }) { const [state, action, pending] = useActionState(inviteUserAction, initial); return <form action={action} className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="invite-name">Nome</Label><Input id="invite-name" name="full_name" required /></div><div><Label htmlFor="invite-email">Email</Label><Input id="invite-email" name="email" type="email" required /></div><div><Label htmlFor="invite-role">Função</Label><NativeSelect id="invite-role" name="role" defaultValue="admin" className="mt-2"><NativeSelectOption value="store">Loja</NativeSelectOption><NativeSelectOption value="kitchen">Cozinha</NativeSelectOption><NativeSelectOption value="admin">Administração</NativeSelectOption></NativeSelect></div><div><Label htmlFor="invite-location">Local</Label><NativeSelect id="invite-location" name="location_id" defaultValue="admin" className="mt-2"><NativeSelectOption value="admin">Sem local (admin)</NativeSelectOption>{locations.map((location) => <NativeSelectOption key={location.id} value={location.id}>{location.name} · {location.kind === "kitchen" ? "cozinha" : "loja"}</NativeSelectOption>)}</NativeSelect></div><div className="md:col-span-2"><Message state={state} /><Button className="mt-3" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}Enviar convite</Button></div></form>; }

export function ToggleButton({ kind, id, active }: { kind: "user" | "location" | "product"; id: string; active: boolean }) { const [pending, start] = useTransition(); return <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const result = kind === "user" ? await toggleUserAction(id, !active) : kind === "location" ? await toggleLocationAction(id, !active) : await toggleProductAction(id, !active); if (result.ok) toast.success(result.message); else toast.error(result.message); })}>{pending && <LoaderCircle className="animate-spin" />}{active ? "Desativar" : "Ativar"}</Button>; }

export function OrderingRulesForm({ settings }: { settings: OrderingSettings }) {
  const [state, action, pending] = useActionState(updateOrderingRulesAction, initial);
  return <form action={action}>
    <FieldGroup className="grid sm:grid-cols-2">
      <Field orientation="horizontal" className="rounded-xl border p-4"><Switch id="phone-required" name="phone_required" defaultChecked={settings.phone_required} /><FieldLabel htmlFor="phone-required">Telefone obrigatório</FieldLabel></Field>
      <Field orientation="horizontal" className="rounded-xl border p-4"><Switch id="notes-required" name="general_notes_required" defaultChecked={settings.general_notes_required} /><FieldLabel htmlFor="notes-required">Observações obrigatórias</FieldLabel></Field>
      <Field><FieldLabel htmlFor="minimum-lead">Antecedência mínima (minutos)</FieldLabel><Input id="minimum-lead" name="minimum_lead_minutes" type="number" min="0" defaultValue={settings.minimum_lead_minutes} required /></Field>
      <Field><FieldLabel htmlFor="booking-horizon">Horizonte de reserva (dias)</FieldLabel><Input id="booking-horizon" name="booking_horizon_days" type="number" min="1" max="365" defaultValue={settings.booking_horizon_days} required /></Field>
      <Field className="sm:col-span-2"><Message state={state} /><Button className="w-fit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar regras</Button></Field>
    </FieldGroup>
  </form>;
}

export function RetentionSettingsForm({ settings }: { settings: OrderingSettings }) {
  const [state, action, pending] = useActionState(updateRetentionSettingsAction, initial);
  return <form action={action}>
    <FieldGroup>
      <Field><FieldLabel htmlFor="retention-months">Retenção de dados (meses)</FieldLabel><Input id="retention-months" name="retention_months" type="number" min="1" max="120" defaultValue={settings.retention_months} required /></Field>
      <Field><Message state={state} /><Button className="w-fit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar retenção</Button></Field>
    </FieldGroup>
  </form>;
}

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

export function CategoryForm() { const [state, action, pending] = useActionState(createCategoryAction, initial); return <form action={action} className="flex flex-col gap-3 sm:flex-row"><Input name="name" aria-label="Nome da nova categoria" placeholder="Nova categoria" required /><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}<Plus data-icon="inline-start" />Adicionar</Button><Message state={state} /></form>; }

type Category = { id: string; name: string; position: number };

function CategoryEditForm({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fieldId = `category-${category.id}`;
  const submit = (data: FormData) => start(async () => {
    setError("");
    const result = await updateCategoryAction(initial, data);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    showUndoToast(result.message, () => updateCategoryAction(initial, formData({ category_id: category.id, name: category.name })));
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil data-icon="inline-start" />Editar</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Editar categoria · {category.name}</DialogTitle><DialogDescription>Atualize o nome e a ordem em que a categoria aparece nos formulários.</DialogDescription></DialogHeader>
      <form action={submit} className="flex flex-col gap-4">
        <input type="hidden" name="category_id" value={category.id} />
        <div className="flex flex-col gap-2"><Label htmlFor={`${fieldId}-name`}>Nome</Label><Input id={`${fieldId}-name`} name="name" defaultValue={category.name} required /></div>
        <Message state={{ ok: false, message: error }} />
        <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar alterações</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function SortableCategoryRow({ category, disabled, first, last, onMove }: { category: Category; disabled: boolean; first: boolean; last: boolean; onMove: (direction: -1 | 1) => void }) {
  const { attributes, listeners, isDragging, setNodeRef, transform, transition } = useSortable({ id: category.id, disabled });
  return <TableRow ref={setNodeRef} data-dragging={isDragging} className="data-[dragging=true]:opacity-70" style={{ transform: CSS.Transform.toString(transform), transition }}>
    <TableCell>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Reordenar ${category.name}`} {...attributes} {...listeners}><GripVertical /><span className="sr-only">Arraste para reordenar</span></Button>
        <Button type="button" variant="ghost" size="icon" disabled={disabled || first} aria-label={`Mover ${category.name} para cima`} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button type="button" variant="ghost" size="icon" disabled={disabled || last} aria-label={`Mover ${category.name} para baixo`} onClick={() => onMove(1)}><ArrowDown /></Button>
      </div>
    </TableCell>
    <TableCell className="font-medium">{category.name}</TableCell>
    <TableCell className="text-right"><CategoryEditForm category={category} /></TableCell>
  </TableRow>;
}

export function CategoryTable({ categories }: { categories: Category[] }) {
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  const contextId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const itemIds = useMemo(() => {
    const available = new Set(categories.map((category) => category.id));
    const preserved = (orderedIds ?? []).filter((id) => available.has(id));
    return [...preserved, ...categories.map((category) => category.id).filter((id) => !preserved.includes(id))];
  }, [categories, orderedIds]);
  const items = itemIds.map((id) => categories.find((category) => category.id === id)).filter((category): category is Category => Boolean(category));

  function saveOrder(next: string[]) {
    const previous = itemIds;
    setOrderedIds(next);
    start(async () => {
      const result = await reorderCategoriesAction(next);
      if (!result.ok) { setOrderedIds(previous); toast.error(result.message); return; }
      showUndoToast(result.message, async () => {
        const undo = await reorderCategoriesAction(previous);
        if (undo.ok) setOrderedIds(previous);
        return undo;
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    saveOrder(arrayMove(itemIds, itemIds.indexOf(String(active.id)), itemIds.indexOf(String(over.id))));
  }

  return <div className="flex flex-col gap-2">
    <p className="text-sm text-muted-foreground">Arraste as linhas para definir a ordem apresentada nos formulários.</p>
    <DndContext id={contextId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
      <Table><TableHeader><TableRow><TableHead className="w-36"><span className="sr-only">Reordenar</span></TableHead><TableHead>Categoria</TableHead><TableHead /></TableRow></TableHeader><TableBody><SortableContext items={itemIds} strategy={verticalListSortingStrategy}>{items.map((category, index) => <SortableCategoryRow key={category.id} category={category} disabled={pending} first={index === 0} last={index === items.length - 1} onMove={(direction) => saveOrder(arrayMove(itemIds, index, index + direction))} />)}</SortableContext></TableBody></Table>
    </DndContext>
  </div>;
}

export function ProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createProductAction, initial);
  return <form action={action}>
    <FieldGroup className="grid sm:grid-cols-2 lg:grid-cols-3">
      <Field><FieldLabel htmlFor="product-category">Categoria</FieldLabel><NativeSelect id="product-category" name="category_id" defaultValue={categories[0]?.id} required><NativeSelectOption value="" disabled>Escolher categoria</NativeSelectOption>{categories.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}</NativeSelect></Field>
      <Field><FieldLabel htmlFor="product-name">Nome</FieldLabel><Input id="product-name" name="name" placeholder="Nome do artigo" required /></Field>
      <Field><FieldLabel htmlFor="product-description">Descrição</FieldLabel><Input id="product-description" name="description" placeholder="Descrição" /></Field>
      <Field><FieldLabel htmlFor="product-unit">Unidade (quantidade normal)</FieldLabel><Input id="product-unit" name="unit_label" defaultValue="un." placeholder="kg, tab., dose…" required /></Field>
      <Field><FieldLabel htmlFor="product-quantity-mode">Forma de escolha</FieldLabel><NativeSelect id="product-quantity-mode" name="quantity_mode" defaultValue="standard"><NativeSelectOption value="standard">Quantidade normal</NativeSelectOption><NativeSelectOption value="selection">Seleção (Pequeno/Grande)</NativeSelectOption><NativeSelectOption value="unit_weight">Unidades com peso individual</NativeSelectOption></NativeSelect></Field>
      <Field><FieldLabel htmlFor="product-weight-unit">Unidade do peso individual</FieldLabel><Input id="product-weight-unit" name="unit_weight_label" defaultValue="kg" maxLength={20} required /></Field>
      <Field><FieldLabel htmlFor="product-minimum">Quantidade mínima</FieldLabel><Input id="product-minimum" name="minimum_quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></Field>
      <Field><FieldLabel htmlFor="product-step">Incremento</FieldLabel><Input id="product-step" name="quantity_step" type="number" min="0.001" step="0.001" defaultValue="1" required /></Field>
      <Field><FieldLabel htmlFor="product-position">Posição na categoria</FieldLabel><Input id="product-position" name="position" type="number" min="0" defaultValue="0" required /></Field>
      <Field className="sm:col-span-2 lg:col-span-3"><FieldLabel htmlFor="product-variations">Opções / variações (uma por linha)</FieldLabel><Textarea id="product-variations" name="variations" placeholder={"Pequeno\nGrande\n\nou\n\nCom recheio\nSem recheio"} /></Field>
      <Field orientation="horizontal"><Switch id="requires-note" name="requires_note" /><FieldLabel htmlFor="requires-note">Observação obrigatória</FieldLabel></Field>
      <Field className="sm:col-span-2 lg:col-span-3"><Message state={state} /><Button className="w-fit" disabled={pending || !categories.length}>{pending && <LoaderCircle className="animate-spin" />}<Plus data-icon="inline-start" />Adicionar artigo</Button></Field>
    </FieldGroup>
  </form>;
}

export function ProductEditForm({ product, categories }: { product: Product; categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fieldId = `product-edit-${product.id}`;
  const submit = (data: FormData) => start(async () => {
    setError("");
    const result = await updateProductAction(initial, data);
    if (!result.ok) { setError(result.message); return; }
    setOpen(false);
    showUndoToast(result.message, () => updateProductAction(initial, formData({
      product_id: product.id,
      category_id: product.category_id,
      name: product.name,
      description: product.description,
      unit_label: product.unit_label,
      minimum_quantity: product.minimum_quantity,
      quantity_step: product.quantity_step,
      quantity_mode: product.quantity_mode,
      unit_weight_label: product.unit_weight_label,
      position: product.position,
      variations: product.variations.join("\n"),
      requires_note: product.requires_note,
    })));
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil data-icon="inline-start" />Editar</Button></DialogTrigger>
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>Editar artigo · {product.name}</DialogTitle><DialogDescription>Atualize todos os dados usados no catálogo e nos formulários de encomenda.</DialogDescription></DialogHeader>
      <form action={submit}>
        <input type="hidden" name="product_id" value={product.id} />
        <FieldGroup className="grid sm:grid-cols-2 lg:grid-cols-3">
          <Field><FieldLabel htmlFor={`${fieldId}-category`}>Categoria</FieldLabel><NativeSelect id={`${fieldId}-category`} name="category_id" defaultValue={product.category_id} required>{categories.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}</NativeSelect></Field>
          <Field><FieldLabel htmlFor={`${fieldId}-name`}>Nome</FieldLabel><Input id={`${fieldId}-name`} name="name" defaultValue={product.name} required /></Field>
          <Field><FieldLabel htmlFor={`${fieldId}-description`}>Descrição</FieldLabel><Input id={`${fieldId}-description`} name="description" defaultValue={product.description} /></Field>
          <Field><FieldLabel htmlFor={`${fieldId}-unit`}>Unidade (quantidade normal)</FieldLabel><Input id={`${fieldId}-unit`} name="unit_label" defaultValue={product.unit_label} required /></Field>
          <Field><FieldLabel htmlFor={`${fieldId}-quantity-mode`}>Forma de escolha</FieldLabel><NativeSelect id={`${fieldId}-quantity-mode`} name="quantity_mode" defaultValue={product.quantity_mode}><NativeSelectOption value="standard">Quantidade normal</NativeSelectOption><NativeSelectOption value="selection">Seleção (Pequeno/Grande)</NativeSelectOption><NativeSelectOption value="unit_weight">Unidades com peso individual</NativeSelectOption></NativeSelect></Field>
          <Field><FieldLabel htmlFor={`${fieldId}-weight-unit`}>Unidade do peso individual</FieldLabel><Input id={`${fieldId}-weight-unit`} name="unit_weight_label" defaultValue={product.unit_weight_label} maxLength={20} required /></Field>
          <Field><FieldLabel htmlFor={`${fieldId}-minimum`}>Quantidade mínima</FieldLabel><Input id={`${fieldId}-minimum`} name="minimum_quantity" type="number" min="0.001" step="0.001" defaultValue={product.minimum_quantity} required /></Field>
          <Field><FieldLabel htmlFor={`${fieldId}-step`}>Incremento</FieldLabel><Input id={`${fieldId}-step`} name="quantity_step" type="number" min="0.001" step="0.001" defaultValue={product.quantity_step} required /></Field>
          <Field><FieldLabel htmlFor={`${fieldId}-position`}>Posição na categoria</FieldLabel><Input id={`${fieldId}-position`} name="position" type="number" min="0" defaultValue={product.position} required /></Field>
          <Field className="sm:col-span-2 lg:col-span-3"><FieldLabel htmlFor={`${fieldId}-variations`}>Opções / variações (uma por linha)</FieldLabel><Textarea id={`${fieldId}-variations`} name="variations" defaultValue={product.variations.join("\n")} placeholder={"Pequeno\nGrande\n\nou\n\nCom recheio\nSem recheio"} /></Field>
          <Field orientation="horizontal"><Switch id={`${fieldId}-requires-note`} name="requires_note" defaultChecked={product.requires_note} /><FieldLabel htmlFor={`${fieldId}-requires-note`}>Observação obrigatória</FieldLabel></Field>
          {error && <FieldError className="sm:col-span-2 lg:col-span-3">{error}</FieldError>}
          <DialogFooter className="sm:col-span-2 lg:col-span-3"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}Guardar alterações</Button></DialogFooter>
        </FieldGroup>
      </form>
    </DialogContent>
  </Dialog>;
}

export function RetryNotificationsButton() { const [pending, start] = useTransition(); return <Button variant="outline" disabled={pending} onClick={() => start(async () => { const result = await retryNotificationsAction(); if (result.ok) toast.success(result.message); else toast.error(result.message); })}>{pending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}Repetir falhadas</Button>; }
