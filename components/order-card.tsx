import Link from "next/link";
import { ArrowRight, CalendarClock, MapPin, Store } from "lucide-react";
import type { Order } from "@/lib/domain";
import { formatDateTime } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export function OrderCard({ order, href }: { order: Order; href: string }) {
  return <Link href={href} className="group block"><Card className="transition hover:border-primary/40 hover:shadow-md"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-muted-foreground">{order.order_number}</p><h3 className="mt-1 text-lg font-semibold">{order.revision?.customer_name || "Dados anonimizados"}</h3></div><StatusBadge status={order.status} revised={order.current_version > 1} /></div><div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><span className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" />{order.revision ? formatDateTime(order.revision.pickup_at) : "—"}</span><span className="flex items-center gap-2"><MapPin className="size-4 text-primary" />{order.pickup_store?.name || "Loja"}</span><span className="flex items-center gap-2"><Store className="size-4 text-primary" />Origem: {order.ordering_store?.name || "Loja"}</span><span className="flex items-center justify-end gap-1 font-medium text-primary">Ver detalhes <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></div></CardContent></Card></Link>;
}
