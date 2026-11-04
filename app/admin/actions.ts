"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { nudgeNotificationWorker } from "@/lib/notification-worker";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { databaseError, settingsSchema, type ActionResult } from "@/lib/validation";

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

export async function updateSettingsAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireProfile(["admin"]);
  const parsed = settingsSchema.safeParse({ phone_required: formData.get("phone_required") === "on", general_notes_required: formData.get("general_notes_required") === "on", minimum_lead_minutes: formData.get("minimum_lead_minutes"), booking_horizon_days: formData.get("booking_horizon_days"), retention_months: formData.get("retention_months") });
  if (!parsed.success) return { ok: false, message: "Verifique os valores das definições." };
  const supabase = await createClient(); const { error } = await supabase!.from("ordering_settings").update({ ...parsed.data, updated_by: actor.id }).eq("id", true);
  if (error) return { ok: false, message: databaseError(error) };
  revalidatePath("/admin/definicoes"); return { ok: true, message: "Definições guardadas." };
}

export async function createLocationAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ name: z.string().trim().min(2), address: z.string().trim().min(2), kind: z.enum(["store", "kitchen"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Indique o nome, morada e tipo do local." };
  const supabase = await createClient(); const { error } = await supabase!.from("locations").insert(parsed.data);
  if (error) return { ok: false, message: databaseError(error, "Já existe uma cozinha ativa ou os dados são inválidos.") };
  revalidatePath("/admin/definicoes"); return { ok: true, message: "Local criado." };
}

export async function toggleLocationAction(locationId: string, active: boolean): Promise<ActionResult> {
  await requireProfile(["admin"]); const supabase = await createClient(); const { error } = await supabase!.from("locations").update({ active }).eq("id", locationId);
  if (error) return { ok: false, message: databaseError(error) }; revalidatePath("/admin/definicoes"); return { ok: true, message: "Local atualizado." };
}

export async function createPickupWindowAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ location_id: z.uuid(), weekday: z.coerce.number().int().min(0).max(6), opens_at: z.string().regex(/^\d{2}:\d{2}$/), closes_at: z.string().regex(/^\d{2}:\d{2}$/), slot_minutes: z.coerce.number().int().min(5).max(240) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Verifique os dados do horário." };
  const supabase = await createClient(); const { error } = await supabase!.from("pickup_windows").insert(parsed.data);
  if (error) return { ok: false, message: databaseError(error) }; revalidatePath("/admin/definicoes"); return { ok: true, message: "Horário adicionado." };
}

export async function createCategoryAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]); const parsed = z.string().trim().min(2).safeParse(formData.get("name")); if (!parsed.success) return { ok: false, message: "Indique o nome da categoria." };
  const supabase = await createClient(); const { error } = await supabase!.from("product_categories").insert({ name: parsed.data }); if (error) return { ok: false, message: databaseError(error) }; revalidatePath("/admin/catalogo"); return { ok: true, message: "Categoria criada." };
}

export async function createProductAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile(["admin"]);
  const parsed = z.object({ category_id: z.uuid(), name: z.string().trim().min(2), description: z.string().trim(), unit_label: z.string().trim().min(1).max(20), minimum_quantity: z.coerce.number().positive(), quantity_step: z.coerce.number().positive(), requires_note: z.boolean() }).safeParse({ ...Object.fromEntries(formData), requires_note: formData.get("requires_note") === "on" });
  if (!parsed.success) return { ok: false, message: "Verifique os dados do artigo." };
  const supabase = await createClient(); const { error } = await supabase!.from("products").insert(parsed.data); if (error) return { ok: false, message: databaseError(error) }; revalidatePath("/admin/catalogo"); return { ok: true, message: "Artigo criado." };
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
