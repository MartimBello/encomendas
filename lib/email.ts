import type { NotificationKind, Order, OrderItem, OrderRevision } from "@/lib/domain";
import { formatDateTime } from "@/lib/dates";
import { formatProductName, formatQuantity } from "@/lib/utils";

const subjects: Record<Extract<NotificationKind, `order_${string}`>, string> = {
  order_accepted: "A sua encomenda foi confirmada",
  order_updated_accepted: "A atualização da sua encomenda foi confirmada",
  order_rejected: "Não foi possível confirmar a sua encomenda",
  order_cancelled: "A sua encomenda foi cancelada",
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export function renderOrderEmail(
  kind: keyof typeof subjects,
  order: Order,
  revision: OrderRevision,
  items: OrderItem[],
) {
  const accent = "#4a7366";
  const heading = subjects[kind];
  const intro =
    kind === "order_rejected"
      ? `Motivo: ${escapeHtml(order.rejection_reason || "Sem disponibilidade")}`
      : kind === "order_cancelled"
        ? "O cancelamento já se encontra registado."
        : kind === "order_accepted" && order.campaign
          ? "A sua encomenda sazonal ficou confirmada automaticamente."
        : "A cozinha confirmou os dados abaixo.";
  const rows = items
    .map(
      (item) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${escapeHtml(formatProductName(item.product_name, item.variation_name))}</td>
    <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">${formatQuantity(item.quantity)} ${escapeHtml(item.unit_label || "")}</td></tr>`,
    )
    .join("");

  return {
    subject: `${heading} · ${order.order_number}`,
    html: `<!doctype html><html lang="pt"><body style="margin:0;background:#f6f7f6;font-family:Arial,sans-serif;color:#17211e">
      <table role="presentation" width="100%"><tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="100%" style="max-width:600px;background:white;border-radius:16px;overflow:hidden">
      <tr><td style="background:${accent};color:white;padding:24px"><strong style="font-size:14px">ENCOMENDAS</strong><h1 style="font-size:24px;margin:8px 0 0">${heading}</h1></td></tr>
      <tr><td style="padding:24px"><p>Olá ${escapeHtml(revision.customer_name || "")},</p><p>${intro}</p>
      <p><strong>${order.order_number}</strong> · versão ${revision.version}</p>
      ${order.campaign ? `<p><strong>Campanha sazonal:</strong> ${escapeHtml(order.campaign.name)}</p>` : ""}
      <p><strong>Levantamento:</strong> ${formatDateTime(revision.pickup_at)}<br><strong>Local:</strong> ${escapeHtml(order.pickup_store?.name || "Loja selecionada")}</p>
      <table role="presentation" width="100%">${rows}</table>
      ${revision.general_notes ? `<p><strong>Observações:</strong><br>${escapeHtml(revision.general_notes)}</p>` : ""}
      <p style="color:#64706c;font-size:13px;margin-top:24px">Se precisar de ajuda, contacte a loja onde registou a encomenda.</p>
      </td></tr></table></td></tr></table></body></html>`,
  };
}
