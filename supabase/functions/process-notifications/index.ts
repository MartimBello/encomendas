import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = { "Content-Type": "application/json" };
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const workerSecret = Deno.env.get("NOTIFICATION_WORKER_SECRET") ?? (!supabaseUrl.includes(".supabase.co") ? "local-worker-secret-change-in-production" : undefined);
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

async function authorized(request: Request) {
  if (workerSecret && request.headers.get("x-worker-secret") === workerSecret) return true;
  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${serviceKey}`;
}

async function loadOrder(job: Record<string, unknown>) {
  const { data: order, error } = await admin.from("orders").select("*, ordering_store:locations!orders_ordering_store_id_fkey(name,address), pickup_store:locations!orders_pickup_store_id_fkey(name,address)").eq("id", job.order_id).single();
  if (error) throw error;
  const { data: revision, error: revisionError } = await admin.from("order_revisions").select("*").eq("order_id", job.order_id).eq("version", job.revision_version).single();
  if (revisionError) throw revisionError;
  const { data: items, error: itemError } = await admin.from("order_items").select("*").eq("revision_id", revision.id).order("position");
  if (itemError) throw itemError;
  return { order, revision, items: items ?? [] };
}

function emailFor(kind: string, order: Record<string, any>, revision: Record<string, any>, items: Record<string, any>[]) {
  const headings: Record<string, string> = {
    order_accepted: "A sua encomenda foi confirmada",
    order_updated_accepted: "A atualização da sua encomenda foi confirmada",
    order_rejected: "Não foi possível confirmar a sua encomenda",
    order_cancelled: "A sua encomenda foi cancelada",
  };
  const heading = headings[kind] || "Atualização da sua encomenda";
  const intro = kind === "order_rejected" ? `Motivo: ${escapeHtml(order.rejection_reason || "Sem disponibilidade")}` : kind === "order_cancelled" ? "O cancelamento já se encontra registado." : "A cozinha confirmou os dados abaixo.";
  const rows = items.map((item) => `<tr><td style="padding:8px 0;border-bottom:1px solid #ddd">${escapeHtml(item.product_name)}</td><td style="text-align:right;border-bottom:1px solid #ddd">${item.quantity} ${escapeHtml(item.unit_label)}</td></tr>`).join("");
  return { subject: `${heading} · ${order.order_number}`, html: `<!doctype html><html lang="pt"><body style="margin:0;background:#f6f7f6;font-family:Arial,sans-serif;color:#17211e"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="background:#4a7366;color:#fff;padding:24px"><strong>ENCOMENDAS</strong><h1 style="font-size:24px">${heading}</h1></td></tr><tr><td style="padding:24px"><p>Olá ${escapeHtml(revision.customer_name || "")},</p><p>${intro}</p><p><strong>${order.order_number}</strong> · versão ${revision.version}</p><p><strong>Levantamento:</strong> ${new Intl.DateTimeFormat("pt-PT", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(revision.pickup_at))}<br><strong>Local:</strong> ${escapeHtml(order.pickup_store?.name || "")}</p><table role="presentation" width="100%">${rows}</table>${revision.general_notes ? `<p><strong>Observações:</strong><br>${escapeHtml(revision.general_notes)}</p>` : ""}</td></tr></table></td></tr></table></body></html>` };
}

async function sendEmail(job: Record<string, any>) {
  const { order, revision, items } = await loadOrder(job);
  const email = emailFor(job.kind, order, revision, items);
  if ((Deno.env.get("MAIL_TRANSPORT") || "log") === "log") { console.log("[mail:log]", job.recipient, email.subject); return `log-${job.id}`; }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY em falta");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": job.id }, body: JSON.stringify({ from: Deno.env.get("RESEND_FROM"), to: job.recipient, subject: email.subject, html: email.html }) });
  const body = await response.json(); if (!response.ok) throw new Error(`Resend ${response.status}: ${JSON.stringify(body).slice(0, 250)}`); return body.id;
}

async function sendPush(job: Record<string, any>) {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) { console.log("[push:log]", job.kind, job.order_id); return "push-log"; }
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:operacoes@example.pt", publicKey, privateKey);
  const { data: subscriptions } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth_key");
  const { order } = await loadOrder(job);
  const payload = JSON.stringify({ title: job.kind === "accepted_order_cancelled" ? "Cancelamento urgente" : "Nova encomenda", body: `${order.order_number} · ${order.pickup_store?.name || "Cozinha"}`, tag: `${job.kind}-${job.order_id}`, url: "/cozinha" });
  for (const subscription of subscriptions ?? []) {
    try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, payload); }
    catch (error) { const status = (error as { statusCode?: number }).statusCode; if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", subscription.id); else throw error; }
  }
  return "web-push";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!(await authorized(request))) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
  const input = await request.json().catch(() => ({}));
  const { data: jobs, error } = await admin.rpc("claim_notification_jobs", { p_limit: Math.min(Number(input.limit) || 20, 100) });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  let sent = 0; let failed = 0;
  for (const job of jobs ?? []) {
    try {
      const providerId = job.channel === "email" ? await sendEmail(job) : await sendPush(job);
      await admin.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerId, last_error: null }).eq("id", job.id);
      await admin.from("notification_delivery_attempts").insert({ notification_id: job.id, attempt_number: job.attempts, succeeded: true, response_code: 200 }); sent += 1;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.slice(0, 500) : "Falha desconhecida";
      const dead = job.attempts >= 6; const delaySeconds = Math.min(60 * 2 ** Math.max(job.attempts - 1, 0), 3600);
      await admin.from("notification_outbox").update({ status: dead ? "dead" : "failed", last_error: message, next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString() }).eq("id", job.id);
      await admin.from("notification_delivery_attempts").insert({ notification_id: job.id, attempt_number: job.attempts, succeeded: false, error_message: message }); failed += 1;
    }
  }
  return new Response(JSON.stringify({ claimed: jobs?.length ?? 0, sent, failed }), { headers: cors });
});
