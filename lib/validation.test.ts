import { describe, expect, it } from "vitest";
import { orderPayloadSchema, settingsSchema } from "@/lib/validation";

const validOrder = {
  idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
  customer_name: "Maria Silva",
  customer_email: "maria@example.pt",
  customer_phone: "912345678",
  pickup_store_id: "10000000-0000-0000-0000-000000000002",
  pickup_at: "2026-12-10T10:00:00.000Z",
  general_notes: "",
  items: [{ product_id: "30000000-0000-0000-0000-000000000001", quantity: 2, note: "" }],
};

describe("order validation", () => {
  it("accepts the complete order contract", () => expect(orderPayloadSchema.safeParse(validOrder).success).toBe(true));
  it("keeps the selected product variation", () => expect(orderPayloadSchema.parse({ ...validOrder, items: [{ ...validOrder.items[0], variation: "Com recheio" }] }).items[0].variation).toBe("Com recheio"));
  it("requires a customer email and at least one item", () => expect(orderPayloadSchema.safeParse({ ...validOrder, customer_email: "bad", items: [] }).success).toBe(false));
  it("rejects non-positive quantities", () => expect(orderPayloadSchema.safeParse({ ...validOrder, items: [{ ...validOrder.items[0], quantity: 0 }] }).success).toBe(false));
});

describe("settings validation", () => {
  it("bounds retention and booking horizons", () => expect(settingsSchema.safeParse({ phone_required: true, general_notes_required: false, minimum_lead_minutes: 60, booking_horizon_days: 366, retention_months: 0 }).success).toBe(false));
});
