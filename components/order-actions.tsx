"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ban, LoaderCircle, Pencil, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelOrderAction } from "@/app/orders/actions";
import type { Order } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function StoreOrderActions({ order }: { order: Order }) {
  const [open, setOpen] = useState(false); const [pending, startTransition] = useTransition(); const router = useRouter();
  const canEdit = order.status !== "cancelled";
  const canRevise = canEdit && !order.campaign_id;
  return <div className="flex flex-wrap gap-2">{canRevise && <Button asChild variant="outline"><Link href={`/loja/encomendas/${order.id}/editar`}><Pencil /> Criar revisão</Link></Button>}{order.status === "accepted" && <Button asChild variant="outline"><Link href={`/encomendas/${order.id}/imprimir`} target="_blank"><Printer /> Imprimir</Link></Button>}{canEdit && <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="destructive"><Ban /> Cancelar</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Cancelar {order.order_number}?</DialogTitle><DialogDescription>{order.status === "accepted" ? "O cliente será informado imediatamente e a cozinha terá de reconhecer o cancelamento." : "A encomenda deixará de estar disponível para aceitação."}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Voltar</Button><Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => { const result = await cancelOrderAction(order.id); if (!result.ok) { toast.error(result.message); return; } toast.success(result.message); setOpen(false); router.refresh(); })}>{pending && <LoaderCircle className="animate-spin" />}Confirmar cancelamento</Button></DialogFooter></DialogContent></Dialog>}</div>;
}
