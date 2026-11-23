import { z } from "zod";

const quantitySchema = z.number().int().min(0).max(9999);

export const weeklyMenuSchema = z.object({
  ementa: z.string().trim().min(1).max(200),
  dataReferencia: z.iso.date(),
  ultimaAtualizacao: z.iso.datetime({ offset: true }),
  categorias: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
  })).max(30),
  dias: z.array(z.object({
    dia: z.string().trim().min(1).max(80),
    diaLabel: z.string().trim().min(1).max(120),
    pratos: z.record(z.string(), z.array(z.string().trim().min(1).max(200)).max(100)),
  })).min(1).max(14),
});

export const weeklyMenuOrderItemSchema = z.object({
  day_key: z.string().trim().min(1).max(80),
  category_key: z.string().trim().min(1).max(80),
  dish_name: z.string().trim().min(1).max(200),
  box_p_quantity: quantitySchema,
  box_m_quantity: quantitySchema,
  pirex_quantity: z.number().int().min(1).max(9999).nullable(),
}).superRefine((item, context) => {
  if (item.pirex_quantity !== null && (item.box_p_quantity > 0 || item.box_m_quantity > 0)) {
    context.addIssue({ code: "custom", message: "Escolha caixas ou Pirex, não ambos." });
  }
  if (item.pirex_quantity === null && item.box_p_quantity === 0 && item.box_m_quantity === 0) {
    context.addIssue({ code: "custom", message: "Indique pelo menos uma quantidade." });
  }
});

export const weeklyMenuOrderPayloadSchema = z.object({
  reference_date: z.iso.date(),
  items: z.array(weeklyMenuOrderItemSchema).max(500),
});

export type WeeklyMenu = z.infer<typeof weeklyMenuSchema>;
export type WeeklyMenuOrderPayload = z.infer<typeof weeklyMenuOrderPayloadSchema>;
