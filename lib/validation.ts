import { z } from "zod";

const databaseUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Identificador inválido.");

export const orderItemSchema = z.object({
  product_id: databaseUuid,
  variation: z.string().trim().max(120).default(""),
  quantity: z.coerce.number().positive(),
  note: z.string().trim().max(500).default(""),
});

export const orderPayloadSchema = z.object({
  idempotency_key: databaseUuid,
  order_id: databaseUuid.optional(),
  ordering_store_id: databaseUuid.nullable().optional(),
  customer_name: z.string().trim().min(2, "Indique o nome do cliente.").max(120),
  customer_email: z.email("Indique um email válido.").toLowerCase(),
  customer_phone: z.string().trim().max(40).default(""),
  pickup_store_id: databaseUuid,
  pickup_at: z.iso.datetime({ offset: true }),
  general_notes: z.string().trim().max(2000).default(""),
  items: z.array(orderItemSchema).min(1, "Adicione pelo menos um artigo.").max(100),
});

export const seasonalOrderPayloadSchema = z.object({
  idempotency_key: databaseUuid,
  campaign_id: databaseUuid,
  ordering_store_id: databaseUuid.nullable().optional(),
  customer_name: z.string().trim().min(2, "Indique o nome do cliente.").max(120),
  customer_email: z.email("Indique um email válido.").toLowerCase(),
  customer_phone: z.string().trim().max(40).default(""),
  pickup_slot_id: databaseUuid,
  pickup_at: z.iso.datetime({ offset: true }),
  general_notes: z.string().trim().max(2000).default(""),
  items: z.array(orderItemSchema).min(1, "Adicione pelo menos um artigo.").max(100),
});

export const settingsSchema = z.object({
  phone_required: z.boolean(),
  general_notes_required: z.boolean(),
  minimum_lead_minutes: z.coerce.number().int().min(0).max(43200),
  booking_horizon_days: z.coerce.number().int().min(1).max(365),
  retention_months: z.coerce.number().int().min(1).max(120),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;
export type SeasonalOrderPayload = z.infer<typeof seasonalOrderPayloadSchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; message: string; fields?: Record<string, string[]> };

export function databaseError(error: unknown, fallback = "Não foi possível concluir a operação.") {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message);
    if (message.length < 180 && !/jwt|key|token|sql|postgres/i.test(message)) return message;
  }
  return fallback;
}
