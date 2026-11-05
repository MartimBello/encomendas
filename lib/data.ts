import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Location, NotificationJob, Order, OrderRevision, OrderStatus, OrderingSettings, PickupWindow, Product, SeasonalCampaign } from "@/lib/domain";

const orderListSelect = `
  id, order_number, campaign_id, ordering_store_id, pickup_store_id, status, current_version,
  current_revision_id, accepted_revision_id, accepted_at, rejected_at, cancelled_at,
  rejection_reason, cancellation_requires_ack, cancellation_acknowledged_at, created_at, updated_at,
  ordering_store:locations!orders_ordering_store_id_fkey(id,name,address),
  pickup_store:locations!orders_pickup_store_id_fkey(id,name,address),
  campaign:seasonal_campaigns(id,name,slug),
  revision:order_revisions!orders_current_revision_fk(id,order_id,version,customer_name,customer_email,customer_phone,pickup_store_id,pickup_at,general_notes,created_at,anonymized_at)
`;

export async function getOrders(options?: { status?: string; search?: string; limit?: number; kind?: "regular" | "seasonal" }) {
  const supabase = await createClient();
  if (!supabase) return [] as Order[];
  let query = supabase.from("orders").select(orderListSelect).order("updated_at", { ascending: false }).limit(options?.limit ?? 100);
  if (options?.status && options.status !== "all") query = query.eq("status", options.status as OrderStatus);
  if (options?.search) query = query.ilike("order_number", `%${options.search.replace(/[%_,()]/g, "")}%`);
  if (options?.kind === "regular") query = query.is("campaign_id", null);
  if (options?.kind === "seasonal") query = query.not("campaign_id", "is", null);
  const { data, error } = await query;
  if (error) throw error;
  const orders = (data ?? []) as unknown as Order[];
  const revisionIds = orders.map((order) => order.revision?.id).filter((id): id is string => Boolean(id));
  if (revisionIds.length) {
    const { data: items } = await supabase.from("order_items").select("*").in("revision_id", revisionIds).order("position");
    for (const order of orders) if (order.revision) order.revision.items = (items ?? []).filter((item) => item.revision_id === order.revision?.id);
  }
  return orders;
}

export async function getSeasonalCampaigns(includeInactive = false) {
  const supabase = await createClient();
  if (!supabase) return [] as SeasonalCampaign[];
  let query = supabase.from("seasonal_campaigns").select("*, products:seasonal_products(*,category:product_categories(id,name,position)), pickup_slots:seasonal_pickup_slots(*,location:locations(id,name,address))").order("ordering_opens_at", { ascending: false });
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as SeasonalCampaign[];
}

export async function getSeasonalCampaign(campaignId: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("seasonal_campaigns").select("*, products:seasonal_products(*,category:product_categories(id,name,position)), pickup_slots:seasonal_pickup_slots(*,location:locations(id,name,address))").eq("id", campaignId).maybeSingle();
  if (error) throw error;
  return data as unknown as SeasonalCampaign | null;
}

export async function getOrder(orderId: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: order, error } = await supabase.from("orders").select(orderListSelect).eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const typed = order as unknown as Order;
  if (typed.revision) {
    const { data: items } = await supabase.from("order_items").select("*").eq("revision_id", typed.revision.id).order("position");
    typed.revision.items = items ?? [];
  }
  const { data: revisions } = await supabase.from("order_revisions").select("*").eq("order_id", orderId).order("version", { ascending: false });
  const typedRevisions = (revisions ?? []) as OrderRevision[];
  const revisionIds = typedRevisions.map((revision) => revision.id);
  if (revisionIds.length) {
    const { data: items } = await supabase.from("order_items").select("*").in("revision_id", revisionIds).order("position");
    for (const revision of typedRevisions) revision.items = (items ?? []).filter((item) => item.revision_id === revision.id);
  }
  return { order: typed, revisions: typedRevisions };
}

export async function getOrderFormOptions() {
  const supabase = await createClient();
  if (!supabase) return { locations: [], products: [], windows: [], settings: defaultSettings };
  const [{ data: locations }, { data: products }, { data: windows }, { data: settings }] = await Promise.all([
    supabase.from("locations").select("*").eq("kind", "store").eq("active", true).order("name"),
    supabase.from("products").select("*, category:product_categories(id,name,position)").eq("active", true).order("position"),
    supabase.from("pickup_windows").select("*").eq("active", true),
    supabase.from("ordering_settings").select("*").eq("id", true).single(),
  ]);
  return {
    locations: (locations ?? []) as Location[],
    products: (products ?? []) as unknown as Product[],
    windows: (windows ?? []) as PickupWindow[],
    settings: (settings ?? defaultSettings) as OrderingSettings,
  };
}

export const defaultSettings: OrderingSettings = {
  phone_required: true,
  general_notes_required: false,
  minimum_lead_minutes: 1440,
  booking_horizon_days: 60,
  retention_months: 24,
};

export async function getNotificationJobs() {
  const supabase = await createClient();
  if (!supabase) return [] as NotificationJob[];
  const { data, error } = await supabase.from("notification_outbox").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as NotificationJob[];
}

export async function getAdminOverview() {
  const supabase = await createClient();
  if (!supabase) return { orders: 0, pending: 0, stores: 0, failures: 0 };
  const [orders, pending, stores, failures] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("locations").select("id", { count: "exact", head: true }).eq("kind", "store").eq("active", true),
    supabase.from("notification_outbox").select("id", { count: "exact", head: true }).in("status", ["failed", "dead"]),
  ]);
  return { orders: orders.count ?? 0, pending: pending.count ?? 0, stores: stores.count ?? 0, failures: failures.count ?? 0 };
}
