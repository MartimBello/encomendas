"use client";

import { useState } from "react";
import type { Order } from "@/lib/domain";
import { formatDateTime } from "@/lib/dates";
import { cn, formatItemQuantity, formatProductName } from "@/lib/utils";
import { PrintControls } from "@/components/print-controls";

export function PrintOrder({
  order,
  obsolete = false,
  initialPaper,
  printedAt,
}: {
  order: Order;
  obsolete?: boolean;
  initialPaper?: "a4" | "80mm";
  printedAt: string;
}) {
  const [paper, setPaper] = useState<"a4" | "80mm">(
    () =>
      initialPaper ??
      (typeof localStorage !== "undefined" && localStorage.getItem("encomendas:paper") === "80mm"
        ? "80mm"
        : "a4"),
  );
  const revision = order.revision!;
  return (
    <main className="mx-auto p-4 print:p-0">
      <PrintControls paper={paper} onPaperChange={setPaper} />
      {obsolete && (
        <div className="mx-auto mb-3 max-w-[210mm] border-4 border-red-700 p-3 text-center text-2xl font-black tracking-[.2em] text-red-700">
          OBSOLETA
        </div>
      )}
      <article
        className={cn(
          "print-card mx-auto rounded-xl border bg-white p-7 text-black shadow-sm",
          paper === "80mm" ? "max-w-[80mm] print-80mm" : "max-w-[210mm] print-a4",
        )}
      >
        <header className="border-b-2 border-black pb-4">
          <p className="text-xs font-bold uppercase tracking-[.2em]">Encomendas · Cozinha</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h1 className="text-2xl font-black">{order.order_number}</h1>
            <p className="font-bold">VERSÃO {revision.version}</p>
          </div>
          {order.campaign && <p className="mt-2 text-sm font-bold uppercase">Campanha sazonal · {order.campaign.name}</p>}
        </header>
        <section className="grid gap-2 border-b py-4 text-sm">
          <p>
            <strong>Cliente:</strong> {revision.customer_name}
          </p>
          <p>
            <strong>Telefone:</strong> {revision.customer_phone || "—"}
          </p>
          <p>
            <strong>Email:</strong> {revision.customer_email || "—"}
          </p>
          <p>
            <strong>Levantamento:</strong> {formatDateTime(revision.pickup_at)}
          </p>
          <p>
            <strong>Loja:</strong> {order.pickup_store?.name} · {order.pickup_store?.address}
          </p>
          <p>
            <strong>Origem:</strong> {order.ordering_store?.name}
          </p>
        </section>
        <section className="py-4">
          <h2 className="mb-3 text-sm font-black uppercase">Artigos</h2>
          {revision.items?.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 border-b border-dashed py-3">
              <div>
                <p className="font-bold">{formatProductName(item.product_name, item.variation_name)}</p>
                {item.item_note && <p className="mt-1 text-sm">Nota: {item.item_note}</p>}
              </div>
              <p className="shrink-0 text-lg font-black">
                {formatItemQuantity(item)}
              </p>
            </div>
          ))}
        </section>
        {revision.general_notes && (
          <section className="border-2 border-black p-3">
            <h2 className="text-xs font-black uppercase">Observações</h2>
            <p className="mt-2 whitespace-pre-wrap">{revision.general_notes}</p>
          </section>
        )}
        <footer className="mt-8 border-t pt-3 text-xs">
          <p>
            Decisão:{" "}
            {order.status === "accepted"
              ? `Aceite em ${order.accepted_at ? formatDateTime(order.accepted_at) : "—"}`
              : order.status === "rejected"
                ? `Rejeitada · ${order.rejection_reason || "Sem disponibilidade"}`
                : "Sem aceitação vigente"}
          </p>
          <p className="mt-1">Impresso em {formatDateTime(printedAt)}</p>
        </footer>
      </article>
    </main>
  );
}
