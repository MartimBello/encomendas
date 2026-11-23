import { describe, expect, it } from "vitest";
import { weeklyMenuOrderPayloadSchema, weeklyMenuSchema } from "@/lib/weekly-menu-schema";

describe("weekly menu schemas", () => {
  it("accepts the central menu shape", () => {
    const result = weeklyMenuSchema.safeParse({
      ementa: "Semana 48 — 23/11 a 28/11",
      dataReferencia: "2026-11-23",
      ultimaAtualizacao: "2026-11-19T14:36:16.839+00:00",
      categorias: [{ key: "carne", label: "Carne" }],
      dias: [{ dia: "segunda", diaLabel: "Segunda-feira", pratos: { carne: ["Panados de Frango"] } }],
    });
    expect(result.success).toBe(true);
  });

  it("preserves the API category keys used to group dishes in the form", () => {
    const menu = weeklyMenuSchema.parse({
      ementa: "Semana 48 — 23/11 a 28/11",
      dataReferencia: "2026-11-23",
      ultimaAtualizacao: "2026-11-19T14:36:16.839+00:00",
      categorias: [
        { key: "sopa", label: "Sopa" },
        { key: "carne", label: "Carne" },
        { key: "peixe", label: "Peixe" },
        { key: "vegetariano", label: "Vegetariano" },
        { key: "acompanhamento", label: "Acompanhamento" },
      ],
      dias: [{
        dia: "sabado",
        diaLabel: "Sábado",
        pratos: {
          sopa: [],
          carne: ["Feijoada à Transmontana", "Cordon Bleu"],
          peixe: ["Paella"],
          vegetariano: ["Tarte de Bróculos e Queijo Brie"],
          acompanhamento: ["Arroz Branco", "Batata ao Murro"],
        },
      }],
    });

    const groupedForForm = Object.fromEntries(menu.categorias.map((category) => [
      category.label,
      menu.dias[0].pratos[category.key] ?? [],
    ]));

    expect(groupedForForm).toEqual({
      Sopa: [],
      Carne: ["Feijoada à Transmontana", "Cordon Bleu"],
      Peixe: ["Paella"],
      Vegetariano: ["Tarte de Bróculos e Queijo Brie"],
      Acompanhamento: ["Arroz Branco", "Batata ao Murro"],
    });
  });

  it("accepts either box quantities or a Pirex quantity", () => {
    const boxes = weeklyMenuOrderPayloadSchema.safeParse({
      reference_date: "2026-11-23",
      items: [{ day_key: "segunda", category_key: "carne", dish_name: "Panados", box_p_quantity: 2, box_m_quantity: 1, pirex_quantity: null }],
    });
    const pirex = weeklyMenuOrderPayloadSchema.safeParse({
      reference_date: "2026-11-23",
      items: [{ day_key: "segunda", category_key: "carne", dish_name: "Panados", box_p_quantity: 0, box_m_quantity: 0, pirex_quantity: 3 }],
    });
    expect(boxes.success).toBe(true);
    expect(pirex.success).toBe(true);
  });

  it("rejects mixed box and Pirex quantities", () => {
    const result = weeklyMenuOrderPayloadSchema.safeParse({
      reference_date: "2026-11-23",
      items: [{ day_key: "segunda", category_key: "carne", dish_name: "Panados", box_p_quantity: 1, box_m_quantity: 0, pirex_quantity: 2 }],
    });
    expect(result.success).toBe(false);
  });
});
