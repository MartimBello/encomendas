"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, CircleMinus, CirclePlus, LoaderCircle, PackagePlus, Send, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { createOrderAction, reviseOrderAction } from "@/app/orders/actions";
import { buildPickupSlots, formatDateTime, pickupSlotParts } from "@/lib/dates";
import type { Location, OrderRevision, OrderingSettings, PickupWindow, Product } from "@/lib/domain";
import { cn, formatQuantity } from "@/lib/utils";
import type { OrderPayload } from "@/lib/validation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PickupSlotPicker } from "@/components/pickup-slot-picker";

type DraftItem = { product_id: string; variation: string; quantity: number; note: string };
type Draft = {
  idempotency_key: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_store_id: string;
  pickup_date: string;
  pickup_time: string;
  pickup_at: string;
  general_notes: string;
  items: DraftItem[];
};

function makeDraft(initial?: OrderRevision): Draft {
  const pickupParts = initial?.pickup_at ? pickupSlotParts(initial.pickup_at) : { date: "", time: "" };
  return {
    idempotency_key: crypto.randomUUID(),
    customer_name: initial?.customer_name || "",
    customer_email: initial?.customer_email || "",
    customer_phone: initial?.customer_phone || "",
    pickup_store_id: initial?.pickup_store_id || "",
    pickup_date: pickupParts.date,
    pickup_time: pickupParts.time,
    pickup_at: initial?.pickup_at || "",
    general_notes: initial?.general_notes || "",
    items: initial?.items?.filter((item) => item.product_id).map((item) => ({ product_id: item.product_id!, variation: item.variation_name || "", quantity: Number(item.quantity), note: item.item_note || "" })) || [],
  };
}

function itemKey(productId: string, variation = "") { return `${productId}\u0000${variation}`; }

export function OrderForm({ locations, products, windows, settings, orderId, initial }: { locations: Location[]; products: Product[]; windows: PickupWindow[]; settings: OrderingSettings; orderId?: string; initial?: OrderRevision }) {
  const router = useRouter();
  const storageKey = `encomendas:draft:${orderId || "new"}`;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(initial));
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    let restoredDraft: Partial<Draft> | null = null;
    if (saved) {
      try {
        const value = JSON.parse(saved);
        if (value.expiresAt > Date.now()) {
          const savedDraft = value.draft as Partial<Draft>;
          const pickupParts = savedDraft.pickup_at ? pickupSlotParts(savedDraft.pickup_at) : { date: "", time: "" };
          restoredDraft = {
            ...savedDraft,
            pickup_date: savedDraft.pickup_date ?? pickupParts.date,
            pickup_time: savedDraft.pickup_time ?? pickupParts.time,
          };
        } else {
          sessionStorage.removeItem(storageKey);
        }
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }
    const restoreFrame = window.requestAnimationFrame(() => {
      if (restoredDraft) setDraft((current) => ({ ...current, ...restoredDraft }));
      setDraftRestored(true);
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, [storageKey]);
  const [pending, startTransition] = useTransition();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, [storageKey]);

  useEffect(() => {
    if (!draftRestored) return;
    sessionStorage.setItem(storageKey, JSON.stringify({ draft, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }));
  }, [draft, draftRestored, storageKey]);

  const slots = useMemo(() => buildPickupSlots(windows, settings.minimum_lead_minutes, settings.booking_horizon_days).filter((slot) => slot.locationId === draft.pickup_store_id), [windows, settings, draft.pickup_store_id]);
  const productChoices = products.flatMap((product) => (product.variations.length ? product.variations : [""]).map((variation) => ({ product, variation, key: itemKey(product.id, variation) })));
  const selectedProducts = draft.items.map((item) => ({ item, product: products.find((product) => product.id === item.product_id)!, key: itemKey(item.product_id, item.variation || "") })).filter((entry) => entry.product);
  const categories = [...new Map(products.map((product) => {
    const name = product.category?.name || "Outros";
    return [name, { name, position: product.category?.position ?? Number.MAX_SAFE_INTEGER }];
  })).values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt"));

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function addProduct(product: Product, variation: string) { setDraft((current) => ({ ...current, items: [...current.items, { product_id: product.id, variation, quantity: Number(product.minimum_quantity), note: "" }] })); }
  function setItem(key: string, patch: Partial<DraftItem>) { setDraft((current) => ({ ...current, items: current.items.map((item) => itemKey(item.product_id, item.variation || "") === key ? { ...item, ...patch } : item) })); }
  function removeProduct(key: string) { setDraft((current) => ({ ...current, items: current.items.filter((item) => itemKey(item.product_id, item.variation || "") !== key) })); }

  function next() {
    if (step === 1 && (!draft.customer_name.trim() || (settings.phone_required && !draft.customer_phone.trim()) || !draft.pickup_store_id || !draft.pickup_at)) return toast.error("Preencha os dados obrigatórios.");
    if (step === 2 && draft.items.length === 0) return toast.error("Adicione pelo menos um artigo.");
    const invalidNote = selectedProducts.some(({ item, product }) => product.requires_note && !item.note.trim());
    if (step === 2 && invalidNote) return toast.error("Preencha as observações obrigatórias dos artigos.");
    setStep((value) => Math.min(3, value + 1));
  }

  function submit() {
    if (!online) return toast.error("Sem ligação. O rascunho ficou guardado neste separador.");
    const payload: OrderPayload = {
      idempotency_key: draft.idempotency_key,
      order_id: orderId,
      ordering_store_id: null,
      customer_name: draft.customer_name,
      customer_email: draft.customer_email,
      customer_phone: draft.customer_phone,
      pickup_store_id: draft.pickup_store_id,
      pickup_at: draft.pickup_at,
      general_notes: draft.general_notes,
      items: draft.items,
    };
    startTransition(async () => {
      const result = orderId ? await reviseOrderAction(payload) : await createOrderAction(payload);
      if (!result.ok) { toast.error(result.message); return; }
      sessionStorage.removeItem(storageKey);
      toast.success(result.message);
      router.push(`/loja/encomendas/${result.data?.orderId}`);
      router.refresh();
    });
  }

  return <div className="space-y-5">
    {!online && <Alert className="border-amber-300 bg-amber-50"><AlertDescription className="flex items-center gap-2 text-amber-900"><WifiOff className="size-4" />Sem ligação. Pode continuar a preencher; o envio ficará bloqueado.</AlertDescription></Alert>}
    <div className="grid grid-cols-3 gap-2">{["Cliente e levantamento", "Artigos", "Rever e enviar"].map((label, index) => <div key={label} className={cn("rounded-xl border px-3 py-3 text-center text-xs font-semibold sm:text-sm", step === index + 1 ? "border-primary bg-primary text-white" : step > index + 1 ? "border-secondary bg-secondary/60" : "bg-card text-muted-foreground")}>{step > index + 1 && <Check className="mr-1 inline size-4" />}{index + 1}. {label}</div>)}</div>

    {step === 1 && <Card><CardHeader><CardTitle>Cliente e levantamento</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><Field id="customer-name" label="Nome do cliente" required><Input id="customer-name" value={draft.customer_name} onChange={(event) => update("customer_name", event.target.value)} autoComplete="name" /></Field><Field id="customer-email" label="Email (opcional)"><Input id="customer-email" type="email" value={draft.customer_email} onChange={(event) => update("customer_email", event.target.value)} autoComplete="email" /></Field><Field id="customer-phone" label="Telefone" required={settings.phone_required}><Input id="customer-phone" type="tel" value={draft.customer_phone} onChange={(event) => update("customer_phone", event.target.value)} inputMode="tel" /></Field><Field id="pickup-store" label="Loja de levantamento" required><NativeSelect id="pickup-store" value={draft.pickup_store_id} onChange={(event) => setDraft((current) => ({ ...current, pickup_store_id: event.target.value, pickup_date: "", pickup_time: "", pickup_at: "" }))}><NativeSelectOption value="" disabled>Escolher loja</NativeSelectOption>{locations.map((location) => <NativeSelectOption key={location.id} value={location.id}>{location.name}</NativeSelectOption>)}</NativeSelect></Field><div className="md:col-span-2"><PickupSlotPicker key={draft.pickup_store_id || "sem-loja"} slots={slots.slice(0, 240)} date={draft.pickup_date} time={draft.pickup_time} value={draft.pickup_at} disabled={!draft.pickup_store_id} onChange={(selection) => setDraft((current) => ({ ...current, pickup_date: selection.date, pickup_time: selection.time, pickup_at: selection.value }))} /></div><Field id="general-notes" label="Observações gerais" required={settings.general_notes_required} className="md:col-span-2"><Textarea id="general-notes" value={draft.general_notes} onChange={(event) => update("general_notes", event.target.value)} placeholder="Alergias, instruções ou informação útil para a cozinha" /></Field></CardContent></Card>}

    {step === 2 && <div className="space-y-5"><Card><CardHeader><CardTitle>Artigos escolhidos <Badge variant="secondary">{draft.items.length}</Badge></CardTitle></CardHeader><CardContent className="space-y-3">{selectedProducts.length === 0 ? <p className="rounded-xl bg-muted p-5 text-center text-sm text-muted-foreground">Ainda não adicionou artigos.</p> : selectedProducts.map(({ item, product, key }) => <div key={key} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{product.name}</h3>{item.variation && <p className="text-sm font-medium text-primary">{item.variation}</p>}<p className="text-sm text-muted-foreground">{product.unit_label} · mínimo {formatQuantity(product.minimum_quantity)}</p></div><Button variant="ghost" size="sm" onClick={() => removeProduct(key)}><CircleMinus /> Remover</Button></div><div className="mt-4 flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Diminuir" onClick={() => setItem(key, { quantity: Math.max(Number(product.minimum_quantity), Number(item.quantity) - Number(product.quantity_step)) })}><CircleMinus /></Button><Input className="w-28 text-center" type="number" min={product.minimum_quantity} step={product.quantity_step} value={item.quantity} onChange={(event) => setItem(key, { quantity: Number(event.target.value) })} /><span className="text-sm text-muted-foreground">{product.unit_label}</span><Button variant="outline" size="icon" aria-label="Aumentar" onClick={() => setItem(key, { quantity: Number(item.quantity) + Number(product.quantity_step) })}><CirclePlus /></Button></div><Textarea className="mt-3 min-h-20" value={item.note} onChange={(event) => setItem(key, { note: event.target.value })} placeholder={product.requires_note ? "Observação obrigatória" : "Observação do artigo (opcional)"} /></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Adicionar ao pedido</CardTitle></CardHeader><CardContent className="space-y-5">{categories.map((category) => <section key={category.name}><h3 className="mb-2 text-sm font-semibold text-muted-foreground">{category.name}</h3><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{productChoices.filter(({ product, key }) => (product.category?.name || "Outros") === category.name && !draft.items.some((item) => itemKey(item.product_id, item.variation || "") === key)).map(({ product, variation, key }) => <Button key={key} variant="outline" className="h-auto min-h-16 justify-start whitespace-normal py-3 text-left" onClick={() => addProduct(product, variation)}><PackagePlus className="shrink-0" /><span><span className="block">{product.name}</span>{variation && <span className="block text-sm font-medium text-primary">{variation}</span>}<span className="block text-xs font-normal text-muted-foreground">{product.description || product.unit_label}</span></span></Button>)}</div></section>)}</CardContent></Card></div>}

    {step === 3 && <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Cliente</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><Review label="Nome" value={draft.customer_name} /><Review label="Email" value={draft.customer_email || "—"} /><Review label="Telefone" value={draft.customer_phone || "—"} /><Review label="Levantamento" value={`${locations.find((location) => location.id === draft.pickup_store_id)?.name || "—"} · ${draft.pickup_at ? formatDateTime(draft.pickup_at) : "—"}`} /><Review label="Observações" value={draft.general_notes || "—"} /></CardContent></Card><Card><CardHeader><CardTitle>Artigos</CardTitle></CardHeader><CardContent className="space-y-3">{selectedProducts.map(({ item, product, key }) => <div key={key} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"><div><p className="font-medium">{product.name}{item.variation ? ` · ${item.variation}` : ""}</p>{item.note && <p className="text-sm text-muted-foreground">{item.note}</p>}</div><p className="shrink-0 font-semibold">{formatQuantity(item.quantity)} {product.unit_label}</p></div>)}</CardContent></Card></div>}

    <div className="sticky bottom-20 z-20 flex justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur md:bottom-4"><Button variant="outline" disabled={step === 1 || pending} onClick={() => setStep((value) => value - 1)}><ChevronLeft /> Anterior</Button>{step < 3 ? <Button onClick={next}>Continuar <ChevronRight /></Button> : <Button size="lg" disabled={pending || !online} onClick={submit}>{pending ? <LoaderCircle className="animate-spin" /> : <Send />}{orderId ? "Enviar revisão" : "Enviar à cozinha"}</Button>}</div>
  </div>;
}

function Field({ id, label, required, className, children }: { id: string; label: string; required?: boolean; className?: string; children: React.ReactNode }) { return <div className={cn("space-y-2", className)}><Label htmlFor={id}>{label}{required && <span className="ml-1 text-destructive">*</span>}</Label>{children}</div>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[110px_1fr] gap-3 border-b py-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>; }
