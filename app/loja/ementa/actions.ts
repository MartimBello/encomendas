"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { databaseError, type ActionResult } from "@/lib/validation";
import { getWeeklyMenu } from "@/lib/weekly-menu";
import { weeklyMenuOrderPayloadSchema, type WeeklyMenuOrderPayload } from "@/lib/weekly-menu-schema";

export async function saveWeeklyMenuOrderAction(payload: WeeklyMenuOrderPayload): Promise<ActionResult<{ orderId: string }>> {
  const profile = await requireProfile(["store"]);
  if (!profile.location_id) return { ok: false, message: "O seu utilizador não está associado a uma loja." };

  const parsed = weeklyMenuOrderPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Confirme as quantidades da encomenda." };

  let menu;
  try {
    menu = await getWeeklyMenu();
  } catch {
    return { ok: false, message: "Não foi possível confirmar a ementa com o sistema central." };
  }

  if (parsed.data.reference_date !== menu.dataReferencia) {
    return { ok: false, message: "A ementa mudou entretanto. Atualize a página antes de guardar." };
  }

  const categories = new Map(menu.categorias.map((category) => [category.key, category.label]));
  const menuItems = new Map<string, { dayLabel: string; categoryLabel: string; position: number }>();
  let position = 0;
  for (const day of menu.dias) {
    for (const category of menu.categorias) {
      for (const dishName of day.pratos[category.key] ?? []) {
        menuItems.set(`${day.dia}\u001f${category.key}\u001f${dishName}`, {
          dayLabel: day.diaLabel,
          categoryLabel: category.label,
          position: position++,
        });
      }
    }
  }

  const canonicalItems = [];
  const seen = new Set<string>();
  for (const item of parsed.data.items) {
    const key = `${item.day_key}\u001f${item.category_key}\u001f${item.dish_name}`;
    const source = menuItems.get(key);
    if (!source || !categories.has(item.category_key) || seen.has(key)) {
      return { ok: false, message: "A ementa mudou entretanto. Atualize a página antes de guardar." };
    }
    seen.add(key);
    canonicalItems.push({
      ...item,
      day_label: source.dayLabel,
      category_label: source.categoryLabel,
      position: source.position,
    });
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Serviço de dados indisponível." };
  const { data, error } = await supabase.rpc("save_weekly_menu_order", {
    p_reference_date: menu.dataReferencia,
    p_menu_title: menu.ementa,
    p_source_updated_at: menu.ultimaAtualizacao,
    p_items: canonicalItems,
  });
  if (error) return { ok: false, message: databaseError(error) };

  revalidatePath("/loja/ementa");
  return { ok: true, data: { orderId: String(data) }, message: "Quantidades guardadas." };
}
