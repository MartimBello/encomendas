"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BellRing, BellRingIcon, Check, ChefHat, Gift, LoaderCircle, Printer, Radio, RefreshCw, Volume2, VolumeX, Wifi, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { acceptOrderAction, acknowledgeCancellationAction, rejectOrderAction, savePushSubscriptionAction } from "@/app/orders/actions";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/domain";
import { formatDateTime } from "@/lib/dates";
import { preparePushSubscription } from "@/lib/push-notifications";
import { formatItemQuantity, formatProductName } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";

export function KitchenBoard({ initialOrders, automaticAcceptance = false }: { initialOrders: Order[]; automaticAcceptance?: boolean }) {
  const router = useRouter();
  const orders = initialOrders;
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState<"checking" | "idle" | "enabled" | "unsupported" | "denied" | "error">("checking");
  const [realtime, setRealtime] = useState<"connecting" | "connected" | "error">(() => createClient() ? "connecting" : "error");
  const [dismissedAttention, setDismissedAttention] = useState<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const pushSyncStarted = useRef(false);

  const syncPushSubscription = useCallback(async (askPermission: boolean) => {
    try {
      if (askPermission) setPushStatus("checking");
      const prepared = await preparePushSubscription(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, askPermission);
      if (prepared.status !== "ready") {
        setPushStatus(prepared.status);
        if (askPermission && prepared.status === "error") toast.error("Não foi possível ativar as notificações neste dispositivo.");
        return false;
      }

      const result = await savePushSubscriptionAction(prepared.subscription);
      setPushStatus(result.ok ? "enabled" : "error");
      if (askPermission) {
        if (result.ok) toast.success("Notificações ativadas neste dispositivo.");
        else toast.error(result.message);
      }
      return result.ok;
    } catch {
      setPushStatus("error");
      if (askPermission) toast.error("Não foi possível sincronizar as notificações.");
      return false;
    }
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    const supabase = createClient();
    if (!supabase) return () => undefined;
    const channel = supabase.channel("kitchen-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => router.refresh()).subscribe((status: string) => setRealtime(status === "SUBSCRIBED" ? "connected" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "error" : "connecting"));
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); void supabase.removeChannel(channel); };
  }, [router]);

  useEffect(() => {
    if (pushSyncStarted.current) return;
    pushSyncStarted.current = true;
    void syncPushSubscription(false);
  }, [syncPushSubscription]);

  const pendingOrders = orders.filter((order) => order.status === "pending");
  const cancellations = orders.filter((order) => order.status === "cancelled" && order.cancellation_requires_ack && !order.cancellation_acknowledged_at);
  const needsAttention = pendingOrders.length + cancellations.length;
  const attentionKey = [...cancellations.map((order) => `${order.id}:cancelled`), ...pendingOrders.map((order) => `${order.id}:${order.current_version}`)].sort().join("|");

  function beep() {
    const context = audioContext.current; if (!context) return;
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = cancellations.length ? "square" : "sine"; oscillator.frequency.value = cancellations.length ? 520 : 740;
    gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.03); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.7);
  }

  useEffect(() => {
    if (!audioEnabled || needsAttention === 0) return;
    beep(); const interval = window.setInterval(beep, 10_000); return () => window.clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEnabled, needsAttention, cancellations.length]);

  async function enableAudio() {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;
    audioContext.current ??= new AudioContextClass();
    await audioContext.current.resume();
    const enabled = audioContext.current.state === "running";
    setAudioEnabled(enabled);
    return enabled;
  }

  async function enableAlerts() {
    await enableAudio();
    await syncPushSubscription(true);
  }

  async function enableSound() {
    const enabled = await enableAudio();
    if (enabled) toast.success("Som ativado enquanto a app estiver aberta.");
    else toast.error("O browser bloqueou o som automático.");
  }

  const history = orders.filter((order) => order.status !== "pending" && !cancellations.some((cancelled) => cancelled.id === order.id));

  return <div className="space-y-6">
    {needsAttention > 0 && dismissedAttention !== attentionKey && <div role="alertdialog" aria-modal="true" aria-labelledby="kitchen-attention-title" className="fixed inset-0 z-[100] grid place-items-center bg-primary p-6 text-white"><div className="max-w-2xl text-center"><BellRing className="mx-auto mb-6 size-20 animate-pulse" /><h2 id="kitchen-attention-title" className="text-4xl font-black sm:text-6xl">{cancellations.length ? "Cancelamento urgente" : "Nova encomenda"}</h2><p className="mt-5 text-xl text-white/80">{cancellations.length ? `${cancellations.length} cancelamento(s) aguardam reconhecimento.` : `${pendingOrders.length} encomenda(s) aguardam decisão.`}</p><Button variant="secondary" size="lg" className="mt-8 min-w-48" onClick={() => setDismissedAttention(attentionKey)}>Abrir fila</Button></div></div>}
    {pushStatus !== "checking" && pushStatus !== "enabled" && <Alert><BellRingIcon /><AlertTitle>{pushStatus === "denied" ? "Notificações bloqueadas no browser" : pushStatus === "unsupported" ? "Notificações indisponíveis" : "Ativar notificações da cozinha"}</AlertTitle><AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span>{pushStatus === "denied" ? "Permita as notificações nas definições do browser ou do sistema. Depois, volte a abrir esta página." : pushStatus === "unsupported" ? "Instale a app num dispositivo compatível para receber alertas em segundo plano." : "A autorização fica guardada neste dispositivo e será recuperada automaticamente nas próximas sessões."}</span>{pushStatus !== "denied" && pushStatus !== "unsupported" && <Button size="sm" onClick={enableAlerts}><BellRing data-icon="inline-start" />Ativar notificações</Button>}</AlertDescription></Alert>}
    <div className="flex flex-wrap gap-2"><Health ok={online} icon={online ? Wifi : WifiOff} label={online ? "Online" : "Sem ligação"} /><Health ok={realtime === "connected"} icon={Radio} label={realtime === "connected" ? "Tempo real ativo" : realtime === "connecting" ? "A ligar…" : "Tempo real com erro"} /><Health ok={audioEnabled} icon={audioEnabled ? Volume2 : VolumeX} label={audioEnabled ? "Som ativo" : "Som desligado"} /><Health ok={pushStatus === "enabled"} icon={BellRing} label={pushStatus === "enabled" ? "Push ativo" : pushStatus === "checking" ? "A verificar push…" : "Push inativo"} />{!audioEnabled && pushStatus === "enabled" && <Button size="sm" variant="outline" onClick={enableSound}><Volume2 data-icon="inline-start" />Ativar som</Button>}<Button size="sm" variant="ghost" onClick={() => router.refresh()}><RefreshCw /> Atualizar</Button></div>
    {cancellations.length > 0 && <section className="space-y-3"><div className="flex items-center gap-2 text-destructive"><AlertTriangle /><h2 className="text-xl font-semibold">Cancelamentos por reconhecer</h2><Badge variant="rejected">{cancellations.length}</Badge></div><div className="grid gap-4 xl:grid-cols-2">{cancellations.map((order) => <CancellationCard key={order.id} order={order} />)}</div></section>}
    {(!automaticAcceptance || pendingOrders.length > 0) && <section className="space-y-3"><div className="flex items-center gap-2"><ChefHat className="text-primary" /><h2 className="text-xl font-semibold">{automaticAcceptance ? "Por regularizar" : "Por aceitar"}</h2><Badge variant="pending">{pendingOrders.length}</Badge></div>{pendingOrders.length ? <div className="grid gap-4 xl:grid-cols-2">{pendingOrders.map((order) => <KitchenCard key={order.id} order={order} />)}</div> : <div className="rounded-2xl border border-dashed bg-card py-12 text-center"><Check className="mx-auto mb-3 size-10 text-primary" /><h3 className="font-semibold">Fila tratada</h3><p className="text-sm text-muted-foreground">Não existem encomendas à espera de decisão.</p></div>}</section>}
    {history.length > 0 && <section className="space-y-3"><h2 className="text-xl font-semibold">{automaticAcceptance ? "Encomendas confirmadas" : "Tratadas recentemente"}</h2><div className="grid gap-3 xl:grid-cols-2">{history.slice(0, 20).map((order) => <Card key={order.id}><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="font-mono text-xs text-muted-foreground">{order.order_number}</p><p className="font-semibold">{order.revision?.customer_name}</p></div><div className="flex items-center gap-2"><StatusBadge status={order.status} />{order.status === "accepted" && <Button asChild size="sm" variant="outline"><Link href={`/encomendas/${order.id}/imprimir`} target="_blank"><Printer /> Imprimir</Link></Button>}</div></CardContent></Card>)}</div></section>}
  </div>;
}

function Health({ ok, icon: Icon, label }: { ok: boolean; icon: typeof Wifi; label: string }) { return <Badge variant={ok ? "accepted" : "outline"} className="gap-1.5 py-1.5"><Icon className="size-3.5" />{label}</Badge>; }

function KitchenCard({ order }: { order: Order }) {
  const [rejectOpen, setRejectOpen] = useState(false); const [reason, setReason] = useState("Sem disponibilidade"); const [pending, startTransition] = useTransition(); const router = useRouter();
  const decide = (kind: "accept" | "reject") => startTransition(async () => { const result = kind === "accept" ? await acceptOrderAction(order.id, order.current_version) : await rejectOrderAction(order.id, order.current_version, reason); if (!result.ok) { toast.error(result.message); return; } toast.success(result.message); setRejectOpen(false); router.refresh(); });
  return <Card role="article" aria-label={order.order_number} className="overflow-hidden border-amber-200"><div className="h-1.5 bg-amber-400" /><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-muted-foreground">{order.order_number} · v{order.current_version}</p><CardTitle className="mt-1">{order.revision?.customer_name}</CardTitle>{order.campaign && <Badge variant="secondary" className="mt-2 gap-1"><Gift className="size-3" />{order.campaign.name}</Badge>}</div>{order.current_version > 1 && <Badge variant="info">Revisão</Badge>}</div></CardHeader><CardContent className="space-y-3 text-sm"><p><strong>Levantamento:</strong> {order.revision && formatDateTime(order.revision.pickup_at)} · {order.pickup_store?.name}</p><p className="text-muted-foreground"><strong>Origem:</strong> {order.ordering_store?.name}</p><div className="rounded-xl bg-muted p-3">{order.revision?.items?.map((item) => <p key={item.id} className="flex justify-between gap-3"><span>{formatProductName(item.product_name, item.variation_name)}</span><strong>{formatItemQuantity(item)}</strong></p>) || <p className="text-muted-foreground">Abra o detalhe para consultar os artigos.</p>}</div>{order.revision?.general_notes && <p className="rounded-xl bg-amber-50 p-3"><strong>Notas:</strong> {order.revision.general_notes}</p>}</CardContent><CardFooter className="grid grid-cols-3"><Button asChild variant="ghost" size="lg"><Link href={`/cozinha/encomendas/${order.id}`}>Detalhes</Link></Button><Button variant="outline" size="lg" onClick={() => setRejectOpen(true)}><X /> Rejeitar</Button><Button size="lg" disabled={pending} onClick={() => decide("accept")}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />} Aceitar</Button></CardFooter><Dialog open={rejectOpen} onOpenChange={setRejectOpen}><DialogContent><DialogHeader><DialogTitle>Rejeitar {order.order_number}</DialogTitle><DialogDescription>O motivo será enviado ao cliente por email.</DialogDescription></DialogHeader><Input value={reason} onChange={(event) => setReason(event.target.value)} autoFocus /><DialogFooter><Button variant="outline" onClick={() => setRejectOpen(false)}>Voltar</Button><Button variant="destructive" disabled={pending || !reason.trim()} onClick={() => decide("reject")}>{pending && <LoaderCircle className="animate-spin" />}Confirmar rejeição</Button></DialogFooter></DialogContent></Dialog></Card>;
}

function CancellationCard({ order }: { order: Order }) { const [pending, startTransition] = useTransition(); const router = useRouter(); return <Card role="article" aria-label={`${order.order_number} cancelada`} className="border-red-300 bg-red-50"><CardHeader><CardTitle className="text-red-900">{order.order_number} foi cancelada</CardTitle></CardHeader><CardContent className="text-sm text-red-900"><p><strong>Cliente:</strong> {order.revision?.customer_name}</p><p><strong>Levantamento:</strong> {order.revision && formatDateTime(order.revision.pickup_at)} · {order.pickup_store?.name}</p></CardContent><CardFooter><Button className="w-full" variant="destructive" disabled={pending} onClick={() => startTransition(async () => { const result = await acknowledgeCancellationAction(order.id); if (!result.ok) { toast.error(result.message); return; } toast.success(result.message); router.refresh(); })}>{pending && <LoaderCircle className="animate-spin" />}Reconhecer cancelamento</Button></CardFooter></Card>; }
