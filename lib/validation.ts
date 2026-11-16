import { z } from "zod";

const databaseUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Identificador inválido.");
const optionalCustomerEmail = z.string().trim().max(254).refine((value) => value === "" || z.email().safeParse(value).success, "Indique um email válido.").transform((value) => value.toLowerCase());

export const orderItemSchema = z.object({
  product_id: databaseUuid,
  variation: z.string().trim().max(120).default(""),
  quantity: z.coerce.number().positive(),
  unit_weights: z.array(z.coerce.number().positive()).max(100).default([]),
  note: z.string().trim().max(500).default(""),
});

const fulfillmentFields = {
  fulfillment_type: z.enum(["pickup", "delivery"]).default("pickup"),
  delivery_address: z.string().trim().max(500).default(""),
};

function requireDeliveryAddress(value: { fulfillment_type: "pickup" | "delivery"; delivery_address: string }, context: z.RefinementCtx) {
  if (value.fulfillment_type === "delivery" && value.delivery_address.length < 5) {
    context.addIssue({ code: "custom", path: ["delivery_address"], message: "Indique a morada de entrega." });
  }
}

export const orderPayloadSchema = z.object({
  idempotency_key: databaseUuid,
  order_id: databaseUuid.optional(),
  ordering_store_id: databaseUuid.nullable().optional(),
  customer_name: z.string().trim().min(2, "Indique o nome do cliente.").max(120),
  customer_email: optionalCustomerEmail,
  customer_phone: z.string().trim().max(40).default(""),
  pickup_store_id: databaseUuid,
  pickup_at: z.iso.datetime({ offset: true }),
  ...fulfillmentFields,
  general_notes: z.string().trim().max(2000).default(""),
  items: z.array(orderItemSchema).min(1, "Adicione pelo menos um artigo.").max(100),
}).superRefine(requireDeliveryAddress);

export const seasonalOrderPayloadSchema = z.object({
  idempotency_key: databaseUuid,
  order_id: databaseUuid.optional(),
  campaign_id: databaseUuid,
  ordering_store_id: databaseUuid.nullable().optional(),
  customer_name: z.string().trim().min(2, "Indique o nome do cliente.").max(120),
  customer_email: optionalCustomerEmail,
  customer_phone: z.string().trim().max(40).default(""),
  pickup_slot_id: databaseUuid,
  pickup_at: z.iso.datetime({ offset: true }),
  ...fulfillmentFields,
  general_notes: z.string().trim().max(2000).default(""),
  items: z.array(orderItemSchema).min(1, "Adicione pelo menos um artigo.").max(100),
}).superRefine(requireDeliveryAddress);

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
