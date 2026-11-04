export type AppRole = "admin" | "store" | "kitchen";
export type LocationType = "store" | "kitchen";
export type OrderStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type OrderEventType =
  | "created"
  | "revised"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "cancellation_acknowledged";
export type NotificationChannel = "email" | "push";
export type NotificationKind =
  | "new_order"
  | "revised_order"
  | "order_accepted"
  | "order_updated_accepted"
  | "order_rejected"
  | "order_cancelled"
  | "accepted_order_cancelled";
export type DeliveryStatus = "pending" | "processing" | "sent" | "failed" | "dead";

export interface Profile {
  id: string;
  full_name: string;
  role: AppRole;
  location_id: string | null;
  active: boolean;
  location?: Location | null;
}

export interface Location {
  id: string;
  name: string;
  kind: LocationType;
  address: string;
  active: boolean;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  unit_label: string;
  minimum_quantity: number;
  quantity_step: number;
  requires_note: boolean;
  active: boolean;
  position: number;
  category?: { name: string } | null;
}

export interface OrderingSettings {
  phone_required: boolean;
  general_notes_required: boolean;
  minimum_lead_minutes: number;
  booking_horizon_days: number;
  retention_months: number;
}

export interface PickupWindow {
  id: string;
  location_id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  slot_minutes: number;
  active: boolean;
}

export interface OrderItem {
  id?: string;
  product_id: string | null;
  product_name?: string;
  unit_label?: string;
  quantity: number;
  item_note?: string;
  note?: string;
  position?: number;
}

export interface OrderRevision {
  id: string;
  order_id: string;
  version: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_store_id: string;
  pickup_at: string;
  general_notes: string;
  created_at: string;
  anonymized_at: string | null;
  items?: OrderItem[];
}

export interface Order {
  id: string;
  order_number: string;
  ordering_store_id: string;
  pickup_store_id: string;
  status: OrderStatus;
  current_version: number;
  current_revision_id: string;
  accepted_revision_id: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  rejection_reason: string | null;
  cancellation_requires_ack: boolean;
  cancellation_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  ordering_store?: Pick<Location, "id" | "name" | "address"> | null;
  pickup_store?: Pick<Location, "id" | "name" | "address"> | null;
  revision?: OrderRevision | null;
}

export interface OrderEvent {
  id: number;
  order_id: string;
  revision_version: number | null;
  event_type: OrderEventType;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationJob {
  id: string;
  order_id: string;
  revision_version: number | null;
  channel: NotificationChannel;
  kind: NotificationKind;
  recipient: string | null;
  status: DeliveryStatus;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
}

export const roleLabels: Record<AppRole, string> = {
  admin: "Administração",
  store: "Loja",
  kitchen: "Cozinha",
};

export const statusLabels: Record<OrderStatus, string> = {
  pending: "Por aceitar",
  accepted: "Aceite",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};
