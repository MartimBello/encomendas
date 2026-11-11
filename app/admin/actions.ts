"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { nudgeNotificationWorker } from "@/lib/notification-worker";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { databaseError, settingsSchema, type ActionResult } from "@/lib/validation";
import { inputLocalToUtc } from "@/lib/dates";

function parseVariations(value: FormDataEntryValue | null) {
  const variations = [...new Set(String(value ?? "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean))];
  return z.array(z.string().min(1).max(120)).max(20).safeParse(variations);
}

const productQuantityFields = {
  quantity_mode: z.enum(["standard", "selection", "unit_weight"]),
  unit_weight_label: z.string().trim().min(1).max(20),
};

function validQuantityConfiguration(quantityMode: string, variations: string[], minimum: number, step: number) {
  if (quantityMode === "selection" && variations.length === 0) return false;
  return quantityMode !== "unit_weight" || (Number.isInteger(minimum) && Number.isInteger(step));
}

export async function inviteUserAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ full_name: z.string().trim().min(2), email: z.email(), role: z.enum(["admin", "store", "kitchen"]), location_id: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Preencha o nome, email, função e local." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Configure SUPABASE_SERVICE_ROLE_KEY para convidar utilizadores." };
  let locationId: string | null = null;
  if (parsed.data.role !== "admin") {
    const location = z.uuid().safeParse(parsed.data.location_id);
    if (!location.success) return { ok: false, message: "Escolha um local compatível com a função." };
    const { data: selected } = await admin.from("locations").select("kind,active").eq("id", location.data).maybeSingle();
    if (!selected?.active || selected.kind !== parsed.data.role) return { ok: false, message: "Escolha um local compatível com a função." };
    locationId = location.data;
  }
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { data: { full_name: parsed.data.full_name }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000"}/auth/callback?next=/auth/definir-password` });
  if (error || !data.user) return { ok: false, message: databaseError(error) };
  const { error: profileError } = await admin.from("profiles").upsert({ id: data.user.id, full_name: parsed.data.full_name, role: parsed.data.role, location_id: locationId, active: true });
  if (profileError) return { ok: false, message: databaseError(profileError, "O convite foi criado, mas falta atribuir a função.") };
  revalidatePath("/admin/utilizadores");
  return { ok: true, message: "Convite enviado." };
}

export async function toggleUserAction(userId: string, active: boolean): Promise<ActionResult> {
  const current = await requireProfile(["admin"]);
  if (current.id === userId && !active) return { ok: false, message: "Não pode desativar a própria conta." };
  const supabase = await createClient();
  const { error } = await supabase!.from("profiles").update({ active }).eq("id", userId);
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/admin/utilizadores"); return { ok: true, message: active ? "Conta ativada." : "Conta desativada." };
}

export async function updateOrderingRulesAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireProfile(["admin"]);
  const parsed = settingsSchema.pick({ phone_required: true, general_notes_required: true, minimum_lead_minutes: true, booking_horizon_days: true }).safeParse({ phone_required: formData.get("phone_required") === "on", general_notes_required: formData.get("general_notes_required") === "on", minimum_lead_minutes: formData.get("minimum_lead_minutes"), booking_horizon_days: formData.get("booking_horizon_days") });
  if (!parsed.success) return { ok: false, message: "Verifique os valores das regras de encomenda." };
  const supabase = await createClient(); const { error } = await supabase!.from("ordering_settings").update({ ...parsed.data, updated_by: actor.id }).eq("id", true);
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/admin/definicoes/regras"); return { ok: true, message: "Regras de encomenda guardadas." };
}

export async function updateRetentionSettingsAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireProfile(["admin"]);
  const parsed = settingsSchema.pick({ retention_months: true }).safeParse({ retention_months: formData.get("retention_months") });
  if (!parsed.success) return { ok: false, message: "Indique uma retenção entre 1 e 120 meses." };
  const supabase = await createClient(); const { error } = await supabase!.from("ordering_settings").update({ ...parsed.data, updated_by: actor.id }).eq("id", true);
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/admin/definicoes/retencao"); return { ok: true, message: "Retenção de dados guardada." };
}

export async function createLocationAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ name: z.string().trim().min(2), address: z.string().trim().min(2), kind: z.enum(["store", "kitchen"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Indique o nome, morada e tipo do local." };
  const supabase = await createClient(); const { error } = await supabase!.from("locations").insert(parsed.data);
  if (error) return { ok: false, message: databaseError(error, "Já existe uma cozinha ativa ou os dados são inválidos.") };
  revalidatePath("/admin/definicoes/locais"); return { ok: true, message: "Local criado." };
}

export async function toggleLocationAction(locationId: string, active: boolean): Promise<ActionResult> {
  await requireProfile(["admin"]); const supabase = await createClient(); const { error } = await supabase!.from("locations").update({ active }).eq("id", locationId);
  if (error) return { ok: false, message: databaseError(error) }; revalidatePath("/admin/definicoes/locais"); return { ok: true, message: "Local atualizado." };
}

export async function createPickupWindowAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ location_id: z.uuid(), weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7), opens_at: z.string().regex(/^\d{2}:\d{2}$/), closes_at: z.string().regex(/^\d{2}:\d{2}$/), slot_minutes: z.coerce.number().int().min(5).max(240) }).safeParse({ ...Object.fromEntries(formData), weekdays: formData.getAll("weekdays") });
  if (!parsed.success || parsed.data.closes_at <= parsed.data.opens_at) return { ok: false, message: "Escolha uma loja, pelo menos um dia e um horário válido." };
  const weekdays = [...new Set(parsed.data.weekdays)];
  const rows = weekdays.map((weekday) => ({ location_id: parsed.data.location_id, weekday, opens_at: parsed.data.opens_at, closes_at: parsed.data.closes_at, slot_minutes: parsed.data.slot_minutes }));
  const supabase = await createClient(); const { error } = await supabase!.from("pickup_windows").insert(rows);
  if (error) return { ok: false, message: databaseError(error) }; revalidatePath("/admin/definicoes/locais"); return { ok: true, message: `Horários adicionados para ${rows.length} dia${rows.length === 1 ? "" : "s"}.` };
}

export async function createCategoryAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ name: z.string().trim().min(2).max(120) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Indique o nome da categoria." };
  const supabase = await createClient();
  const { data: lastCategory, error: orderError } = await supabase!.from("product_categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  if (orderError) return { ok: false, message: databaseError(orderError) };
  const { error } = await supabase!.from("product_categories").insert({ name: parsed.data.name, position: (lastCategory?.position ?? 0) + 10 });
  if (error) return { ok: false, message: databaseError(error) };
  revalidateCategoryRoutes();
  return { ok: true, message: "Categoria criada." };
}

export async function updateCategoryAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ category_id: z.uuid(), name: z.string().trim().min(2).max(120) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Indique o nome da categoria." };
  const { category_id, ...updates } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase!.from("product_categories").update(updates).eq("id", category_id).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "A categoria não existe ou não pôde ser atualizada.") };
  revalidateCategoryRoutes();
  return { ok: true, message: "Categoria atualizada." };
}

export async function reorderCategoriesAction(categoryIds: string[]): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.array(z.uuid()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length).safeParse(categoryIds);
  if (!parsed.success) return { ok: false, message: "A ordem das categorias é inválida." };

  const supabase = await createClient();
  const { data: categories, error: readError } = await supabase!.from("product_categories").select("id,position");
  if (readError) return { ok: false, message: databaseError(readError) };
  const existingIds = new Set((categories ?? []).map((category) => category.id));
  if (existingIds.size !== parsed.data.length || parsed.data.some((id) => !existingIds.has(id))) {
    return { ok: false, message: "Atualize a página antes de reordenar as categorias." };
  }

  const previousPositions = new Map((categories ?? []).map((category) => [category.id, category.position]));
  const results = await Promise.all(parsed.data.map((id, index) => supabase!.from("product_categories").update({ position: (index + 1) * 10 }).eq("id", id)));
  const failed = results.find((result) => result.error)?.error;
  if (failed) {
    await Promise.all([...previousPositions].map(([id, position]) => supabase!.from("product_categories").update({ position }).eq("id", id)));
    return { ok: false, message: databaseError(failed, "Não foi possível guardar a ordem das categorias.") };
  }

  revalidateCategoryRoutes();
  return { ok: true, message: "Ordem das categorias atualizada." };
}

function revalidateCategoryRoutes() {
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/sazonais");
  revalidatePath("/admin/sazonais/[campaignId]", "page");
  revalidatePath("/loja/encomendas/nova");
  revalidatePath("/loja/sazonais/[campaignId]", "page");
}

export async function createProductAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ category_id: z.uuid(), name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000), unit_label: z.string().trim().min(1).max(20), minimum_quantity: z.coerce.number().positive(), quantity_step: z.coerce.number().positive(), position: z.coerce.number().int().min(0), requires_note: z.boolean(), ...productQuantityFields }).safeParse({ ...Object.fromEntries(formData), requires_note: formData.get("requires_note") === "on" });
  const variations = parseVariations(formData.get("variations"));
  if (!parsed.success || !variations.success || !validQuantityConfiguration(parsed.data.quantity_mode, variations.data, parsed.data.minimum_quantity, parsed.data.quantity_step)) return { ok: false, message: "Verifique os dados do artigo. A seleção precisa de opções e as unidades com peso precisam de quantidades inteiras." };
  const supabase = await createClient(); const { error } = await supabase!.from("products").insert({ ...parsed.data, variations: variations.data }); if (error) return { ok: false, message: databaseError(error) }; revalidateProductRoutes(); return { ok: true, message: "Artigo criado." };
}

export async function updateProductAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ product_id: z.uuid(), category_id: z.uuid(), name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000), unit_label: z.string().trim().min(1).max(20), minimum_quantity: z.coerce.number().positive(), quantity_step: z.coerce.number().positive(), position: z.coerce.number().int().min(0), requires_note: z.boolean(), ...productQuantityFields }).safeParse({ ...Object.fromEntries(formData), requires_note: formData.get("requires_note") === "on" });
  const variations = parseVariations(formData.get("variations"));
  if (!parsed.success || !variations.success || !validQuantityConfiguration(parsed.data.quantity_mode, variations.data, parsed.data.minimum_quantity, parsed.data.quantity_step)) return { ok: false, message: "Verifique os dados do artigo. A seleção precisa de opções e as unidades com peso precisam de quantidades inteiras." };
  const { product_id: productId, ...updates } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase!.from("products").update({ ...updates, variations: variations.data }).eq("id", productId).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "O artigo não existe ou não pôde ser atualizado.") };
  revalidateProductRoutes();
  return { ok: true, message: "Artigo atualizado." };
}

function revalidateProductRoutes() {
  revalidatePath("/admin/catalogo");
  revalidatePath("/loja/encomendas/nova");
}

export async function toggleProductAction(productId: string, active: boolean): Promise<ActionResult> {
  await requireProfile(["admin"]); const supabase = await createClient(); const { error } = await supabase!.from("products").update({ active }).eq("id", productId); if (error) return { ok: false, message: databaseError(error) }; revalidatePath("/admin/catalogo"); return { ok: true, message: "Artigo atualizado." };
}

export async function retryNotificationsAction(): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "A chave de serviço não está configurada." };
  const { error } = await admin.from("notification_outbox").update({ status: "pending", next_attempt_at: new Date().toISOString() }).in("status", ["failed", "dead"]);
  if (error) return { ok: false, message: databaseError(error) };
  const started = await nudgeNotificationWorker(50);
  revalidatePath("/admin/notificacoes");
  return started ? { ok: true, message: "Nova tentativa iniciada." } : { ok: false, message: "As entregas ficaram em fila para a próxima execução." };
}

export async function createSeasonalCampaignAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireProfile(["admin"]);
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(1000),
    opens_date: z.iso.date(), opens_time: z.string().regex(/^\d{2}:\d{2}$/),
    closes_date: z.iso.date(), closes_time: z.string().regex(/^\d{2}:\d{2}$/),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Verifique o nome, identificador e período de aceitação." };
  const opensAt = inputLocalToUtc(`${parsed.data.opens_date}T${parsed.data.opens_time}`);
  const closesAt = inputLocalToUtc(`${parsed.data.closes_date}T${parsed.data.closes_time}`);
  if (new Date(closesAt) <= new Date(opensAt)) return { ok: false, message: "O fim da aceitação tem de ser posterior ao início." };
  const supabase = await createClient();
  const { error } = await supabase!.from("seasonal_campaigns").insert({ name: parsed.data.name, slug: parsed.data.slug, description: parsed.data.description, ordering_opens_at: opensAt, ordering_closes_at: closesAt, active: false, created_by: actor.id, updated_by: actor.id });
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/admin/sazonais"); return { ok: true, message: "Campanha criada como inativa." };
}

export async function updateSeasonalCampaignAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireProfile(["admin"]);
  const parsed = z.object({
    campaign_id: z.uuid(),
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(1000),
    opens_date: z.iso.date(), opens_time: z.string().regex(/^\d{2}:\d{2}$/),
    closes_date: z.iso.date(), closes_time: z.string().regex(/^\d{2}:\d{2}$/),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Verifique o nome, identificador e período de aceitação." };
  const opensAt = inputLocalToUtc(`${parsed.data.opens_date}T${parsed.data.opens_time}`);
  const closesAt = inputLocalToUtc(`${parsed.data.closes_date}T${parsed.data.closes_time}`);
  if (new Date(closesAt) <= new Date(opensAt)) return { ok: false, message: "O fim da aceitação tem de ser posterior ao início." };
  const supabase = await createClient();
  const { data, error } = await supabase!.from("seasonal_campaigns").update({ name: parsed.data.name, slug: parsed.data.slug, description: parsed.data.description, ordering_opens_at: opensAt, ordering_closes_at: closesAt, updated_by: actor.id }).eq("id", parsed.data.campaign_id).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "A campanha não existe ou não pôde ser atualizada.") };
  revalidateSeasonalRoutes(parsed.data.campaign_id);
  return { ok: true, message: "Campanha atualizada." };
}

export async function toggleSeasonalCampaignAction(campaignId: string, active: boolean): Promise<ActionResult> {
  const actor = await requireProfile(["admin"]); const supabase = await createClient();
  const { error } = await supabase!.from("seasonal_campaigns").update({ active, updated_by: actor.id }).eq("id", campaignId);
  if (error) return { ok: false, message: databaseError(error) };
  revalidateSeasonalRoutes(campaignId); return { ok: true, message: active ? "Campanha publicada." : "Campanha desativada." };
}

function revalidateSeasonalRoutes(campaignId: string) {
  revalidatePath("/admin/sazonais");
  revalidatePath(`/admin/sazonais/${campaignId}`);
  revalidatePath("/loja/sazonais");
  revalidatePath(`/loja/sazonais/${campaignId}`);
}

export async function createSeasonalProductAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ campaign_id: z.uuid(), category_id: z.uuid(), name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000), unit_label: z.string().trim().min(1).max(20), minimum_quantity: z.coerce.number().positive(), quantity_step: z.coerce.number().positive(), position: z.coerce.number().int().min(0), stock_limit: z.preprocess((value) => value === "" ? null : value, z.coerce.number().positive().nullable()), requires_note: z.boolean(), ...productQuantityFields }).safeParse({ ...Object.fromEntries(formData), requires_note: formData.get("requires_note") === "on" });
  const variations = parseVariations(formData.get("variations"));
  if (!parsed.success || !variations.success || !validQuantityConfiguration(parsed.data.quantity_mode, variations.data, parsed.data.minimum_quantity, parsed.data.quantity_step)) return { ok: false, message: "Verifique os dados do artigo sazonal. A seleção precisa de opções e as unidades com peso precisam de quantidades inteiras." };
  const supabase = await createClient(); const { error } = await supabase!.from("seasonal_products").insert({ ...parsed.data, variations: variations.data });
  if (error) return { ok: false, message: databaseError(error) };
  revalidateSeasonalRoutes(parsed.data.campaign_id); return { ok: true, message: "Artigo adicionado ao menu especial." };
}

export async function updateSeasonalProductAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ product_id: z.uuid(), category_id: z.preprocess((value) => value === "" ? null : value, z.uuid().nullable()), name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000), unit_label: z.string().trim().min(1).max(20), minimum_quantity: z.coerce.number().positive(), quantity_step: z.coerce.number().positive(), position: z.coerce.number().int().min(0), stock_limit: z.preprocess((value) => value === "" ? null : value, z.coerce.number().positive().nullable()), requires_note: z.boolean(), ...productQuantityFields }).safeParse({ ...Object.fromEntries(formData), requires_note: formData.get("requires_note") === "on" });
  const variations = parseVariations(formData.get("variations"));
  if (!parsed.success || !variations.success || !validQuantityConfiguration(parsed.data.quantity_mode, variations.data, parsed.data.minimum_quantity, parsed.data.quantity_step)) return { ok: false, message: "Verifique os dados do artigo sazonal. A seleção precisa de opções e as unidades com peso precisam de quantidades inteiras." };
  const { product_id: productId, ...updates } = parsed.data;
  const supabase = await createClient(); const { data, error } = await supabase!.from("seasonal_products").update({ ...updates, variations: variations.data }).eq("id", productId).select("campaign_id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "O artigo não existe ou não pôde ser atualizado.") };
  revalidateSeasonalRoutes(data.campaign_id);
  return { ok: true, message: "Artigo atualizado." };
}

export async function deleteSeasonalProductAction(productId: string): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return { ok: false, message: "Artigo inválido." };
  const supabase = await createClient(); const { data, error } = await supabase!.from("seasonal_products").delete().eq("id", parsed.data).select("campaign_id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "O artigo não existe ou não pôde ser removido.") };
  revalidateSeasonalRoutes(data.campaign_id);
  return { ok: true, message: "Artigo removido." };
}

export async function createSeasonalPickupSlotAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ campaign_id: z.uuid(), location_ids: z.string().min(36), pickup_dates: z.string().min(10), opens_at: z.string().regex(/^\d{2}:\d{2}$/), closes_at: z.string().regex(/^\d{2}:\d{2}$/), slot_minutes: z.coerce.number().int().min(5).max(240) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Escolha a campanha, uma ou mais lojas, pelo menos um dia e o intervalo de abertura." };
  const dates = parsed.data.pickup_dates.split(",").filter((value) => z.iso.date().safeParse(value).success);
  const locationIds = parsed.data.location_ids.split(",").filter((value) => z.uuid().safeParse(value).success);
  if (!dates.length || !locationIds.length || parsed.data.closes_at <= parsed.data.opens_at) return { ok: false, message: "Escolha dias, lojas e um intervalo de abertura válido." };
  const rows = locationIds.flatMap((locationId) => dates.map((pickupDate) => ({ campaign_id: parsed.data.campaign_id, location_id: locationId, pickup_date: pickupDate, opens_at: parsed.data.opens_at, closes_at: parsed.data.closes_at, slot_minutes: parsed.data.slot_minutes })));
  const supabase = await createClient(); const { error } = await supabase!.from("seasonal_pickup_slots").insert(rows);
  if (error) return { ok: false, message: databaseError(error) };
  revalidateSeasonalRoutes(parsed.data.campaign_id); return { ok: true, message: "Dia e hora de levantamento adicionados." };
}

export async function updateSeasonalPickupSlotAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ slot_id: z.uuid(), location_id: z.uuid(), pickup_date: z.iso.date(), opens_at: z.string().regex(/^\d{2}:\d{2}$/), closes_at: z.string().regex(/^\d{2}:\d{2}$/), slot_minutes: z.coerce.number().int().min(5).max(240) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.closes_at <= parsed.data.opens_at) return { ok: false, message: "Escolha uma loja, uma data e um intervalo de abertura válido." };
  const { slot_id: slotId, ...updates } = parsed.data;
  const supabase = await createClient(); const { data, error } = await supabase!.from("seasonal_pickup_slots").update(updates).eq("id", slotId).select("campaign_id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "O dia de levantamento não existe ou não pôde ser atualizado.") };
  revalidateSeasonalRoutes(data.campaign_id);
  return { ok: true, message: "Dia de levantamento atualizado." };
}

export async function deleteSeasonalPickupSlotAction(slotId: string): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.uuid().safeParse(slotId);
  if (!parsed.success) return { ok: false, message: "Dia de levantamento inválido." };
  const supabase = await createClient(); const { data, error } = await supabase!.from("seasonal_pickup_slots").delete().eq("id", parsed.data).select("campaign_id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "O dia de levantamento não existe ou não pôde ser removido.") };
  revalidateSeasonalRoutes(data.campaign_id);
  return { ok: true, message: "Dia de levantamento removido." };
}

export async function toggleSeasonalProductAction(productId: string, active: boolean): Promise<ActionResult> {
  await requireProfile(["admin"]); const supabase = await createClient(); const { data, error } = await supabase!.from("seasonal_products").update({ active }).eq("id", productId).select("campaign_id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "O artigo não existe ou não pôde ser atualizado.") }; revalidateSeasonalRoutes(data.campaign_id); return { ok: true, message: "Artigo atualizado." };
}

export async function toggleSeasonalPickupSlotAction(slotId: string, active: boolean): Promise<ActionResult> {
  await requireProfile(["admin"]); const supabase = await createClient(); const { data, error } = await supabase!.from("seasonal_pickup_slots").update({ active }).eq("id", slotId).select("campaign_id").maybeSingle();
  if (error || !data) return { ok: false, message: databaseError(error, "O horário não existe ou não pôde ser atualizado.") }; revalidateSeasonalRoutes(data.campaign_id); return { ok: true, message: "Horário atualizado." };
}
