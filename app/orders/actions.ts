"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { nudgeNotificationWorker } from "@/lib/notification-worker";
import { createClient } from "@/lib/supabase/server";
import { databaseError, orderPayloadSchema, seasonalOrderPayloadSchema, type ActionResult, type OrderPayload, type SeasonalOrderPayload } from "@/lib/validation";

export async function createOrderAction(payload: OrderPayload): Promise<ActionResult<{ orderId: string }>> {
  const profile = await requireProfile(["store", "admin"]);
  const parsed = orderPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Confirme os campos assinalados.", fields: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Serviço de dados indisponível." };
  const { data, error } = await supabase.rpc("create_order", {
    p_idempotency_key: parsed.data.idempotency_key,
    p_customer_name: parsed.data.customer_name,
    p_customer_email: parsed.data.customer_email,
    p_customer_phone: parsed.data.customer_phone,
    p_pickup_store_id: parsed.data.pickup_store_id,
    p_pickup_at: parsed.data.pickup_at,
    p_general_notes: parsed.data.general_notes,
    p_items: parsed.data.items,
    p_ordering_store_id: profile.role === "admin" ? parsed.data.ordering_store_id ?? undefined : undefined,
  });
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/loja/encomendas");
  await nudgeNotificationWorker();
  return { ok: true, data: { orderId: String(data) }, message: "Encomenda enviada à cozinha." };
}

export async function createSeasonalOrderAction(payload: SeasonalOrderPayload): Promise<ActionResult<{ orderId: string }>> {
  const profile = await requireProfile(["store", "admin"]);
  const parsed = seasonalOrderPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Confirme os campos e adicione pelo menos um artigo." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Serviço de dados indisponível." };
  const { data, error } = await supabase.rpc("create_seasonal_order", {
    p_idempotency_key: parsed.data.idempotency_key,
    p_campaign_id: parsed.data.campaign_id,
    p_customer_name: parsed.data.customer_name,
    p_customer_email: parsed.data.customer_email,
    p_customer_phone: parsed.data.customer_phone,
    p_pickup_slot_id: parsed.data.pickup_slot_id,
    p_pickup_at: parsed.data.pickup_at,
    p_general_notes: parsed.data.general_notes,
    p_items: parsed.data.items,
    p_ordering_store_id: profile.role === "admin" ? parsed.data.ordering_store_id ?? undefined : undefined,
  });
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/loja/sazonais"); revalidatePath("/cozinha/sazonais");
  await nudgeNotificationWorker();
  return { ok: true, data: { orderId: String(data) }, message: "Encomenda sazonal enviada à cozinha." };
}

export async function reviseOrderAction(payload: OrderPayload): Promise<ActionResult<{ orderId: string }>> {
  await requireProfile(["store", "admin"]);
  const parsed = orderPayloadSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.order_id) return { ok: false, message: "Confirme os dados da revisão." };
  const supabase = await createClient();
  const { error } = await supabase!.rpc("submit_order_revision", {
    p_order_id: parsed.data.order_id,
    p_customer_name: parsed.data.customer_name,
    p_customer_email: parsed.data.customer_email,
    p_customer_phone: parsed.data.customer_phone,
    p_pickup_store_id: parsed.data.pickup_store_id,
    p_pickup_at: parsed.data.pickup_at,
    p_general_notes: parsed.data.general_notes,
    p_items: parsed.data.items,
  });
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/loja/encomendas");
  revalidatePath(`/loja/encomendas/${parsed.data.order_id}`);
  await nudgeNotificationWorker();
  return { ok: true, data: { orderId: parsed.data.order_id }, message: "Revisão enviada para nova aceitação." };
}

export async function acceptOrderAction(orderId: string, expectedVersion: number): Promise<ActionResult> {
  await requireProfile(["kitchen", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase!.rpc("accept_order", { p_order_id: orderId, p_expected_version: expectedVersion });
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/cozinha");
  revalidatePath("/cozinha/sazonais");
  await nudgeNotificationWorker();
  return { ok: true, message: "Encomenda aceite e confirmação preparada." };
}

export async function rejectOrderAction(orderId: string, expectedVersion: number, reason: string): Promise<ActionResult> {
  await requireProfile(["kitchen", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase!.rpc("reject_order", { p_order_id: orderId, p_expected_version: expectedVersion, p_reason: reason || "Sem disponibilidade" });
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/cozinha");
  revalidatePath("/cozinha/sazonais");
  await nudgeNotificationWorker();
  return { ok: true, message: "Encomenda rejeitada." };
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  await requireProfile(["store", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase!.rpc("cancel_order", { p_order_id: orderId });
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/loja/encomendas");
  revalidatePath("/loja/sazonais");
  revalidatePath(`/loja/encomendas/${orderId}`);
  await nudgeNotificationWorker();
  return { ok: true, message: "Encomenda cancelada." };
}

export async function acknowledgeCancellationAction(orderId: string): Promise<ActionResult> {
  await requireProfile(["kitchen", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase!.rpc("acknowledge_cancellation", { p_order_id: orderId });
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/cozinha");
  revalidatePath("/cozinha/sazonais");
  return { ok: true, message: "Cancelamento reconhecido." };
}

export async function savePushSubscriptionAction(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<ActionResult> {
  const profile = await requireProfile(["kitchen", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase!.from("push_subscriptions").upsert({ user_id: profile.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth_key: subscription.keys.auth, user_agent: "browser", last_seen_at: new Date().toISOString() }, { onConflict: "endpoint" });
  return error ? { ok: false, message: databaseError(error) } : { ok: true, message: "Notificações ativadas." };
}
