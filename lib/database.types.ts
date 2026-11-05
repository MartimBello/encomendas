
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "locations": {
                  Row: {
                    "active": boolean,"address": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["location_type"],"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address"?: string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["location_type"],"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["location_type"],"name"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"notification_delivery_attempts": {
                  Row: {
                    "attempt_number": number,"created_at": string,"error_message": string | null,"id": number,"notification_id": string,"response_code": number | null,"succeeded": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_number": number,"created_at"?: string,"error_message"?: string | null,"id"?: never,"notification_id": string,"response_code"?: number | null,"succeeded": boolean
                  }
                  Update: {
                    "attempt_number"?: number,"created_at"?: string,"error_message"?: string | null,"id"?: never,"notification_id"?: string,"response_code"?: number | null,"succeeded"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_delivery_attempts_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "notification_outbox"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"id": string,"kind": Database["public"]['Enums']["notification_kind"],"last_error": string | null,"next_attempt_at": string,"order_id": string | null,"provider_message_id": string | null,"recipient": string | null,"revision_version": number | null,"sent_at": string | null,"status": Database["public"]['Enums']["delivery_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["notification_kind"],"last_error"?: string | null,"next_attempt_at"?: string,"order_id"?: string | null,"provider_message_id"?: string | null,"recipient"?: string | null,"revision_version"?: number | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["delivery_status"]
                  }
                  Update: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["notification_kind"],"last_error"?: string | null,"next_attempt_at"?: string,"order_id"?: string | null,"provider_message_id"?: string | null,"recipient"?: string | null,"revision_version"?: number | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["delivery_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"event_type": Database["public"]['Enums']["order_event_type"],"id": number,"metadata": NonNullable<Json>,"order_id": string,"revision_version": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"event_type": Database["public"]['Enums']["order_event_type"],"id"?: never,"metadata"?: NonNullable<Json>,"order_id": string,"revision_version"?: number | null
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"event_type"?: Database["public"]['Enums']["order_event_type"],"id"?: never,"metadata"?: NonNullable<Json>,"order_id"?: string,"revision_version"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"item_note": string,"position": number,"product_id": string | null,"product_name": string,"quantity": number,"revision_id": string,"seasonal_product_id": string | null,"unit_label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"item_note"?: string,"position"?: number,"product_id"?: string | null,"product_name": string,"quantity": number,"revision_id": string,"seasonal_product_id"?: string | null,"unit_label": string
                  }
                  Update: {
                    "id"?: string,"item_note"?: string,"position"?: number,"product_id"?: string | null,"product_name"?: string,"quantity"?: number,"revision_id"?: string,"seasonal_product_id"?: string | null,"unit_label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_revision_id_fkey"
      columns: ["revision_id"]
isOneToOne: false
      referencedRelation: "order_revisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_seasonal_product_id_fkey"
      columns: ["seasonal_product_id"]
isOneToOne: false
      referencedRelation: "seasonal_products"
      referencedColumns: ["id"]
    }
                  ]
                },"order_revisions": {
                  Row: {
                    "anonymized_at": string | null,"created_at": string,"created_by": string,"customer_email": string | null,"customer_name": string | null,"customer_phone": string | null,"general_notes": string,"id": string,"order_id": string,"pickup_at": string,"pickup_store_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymized_at"?: string | null,"created_at"?: string,"created_by": string,"customer_email"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"general_notes"?: string,"id"?: string,"order_id": string,"pickup_at": string,"pickup_store_id": string,"version": number
                  }
                  Update: {
                    "anonymized_at"?: string | null,"created_at"?: string,"created_by"?: string,"customer_email"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"general_notes"?: string,"id"?: string,"order_id"?: string,"pickup_at"?: string,"pickup_store_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_revisions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_revisions_pickup_store_id_fkey"
      columns: ["pickup_store_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"ordering_settings": {
                  Row: {
                    "booking_horizon_days": number,"general_notes_required": boolean,"id": boolean,"minimum_lead_minutes": number,"phone_required": boolean,"retention_months": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_horizon_days"?: number,"general_notes_required"?: boolean,"id"?: boolean,"minimum_lead_minutes"?: number,"phone_required"?: boolean,"retention_months"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "booking_horizon_days"?: number,"general_notes_required"?: boolean,"id"?: boolean,"minimum_lead_minutes"?: number,"phone_required"?: boolean,"retention_months"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [

                  ]
                },"orders": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"accepted_revision_id": string | null,"campaign_id": string | null,"cancellation_acknowledged_at": string | null,"cancellation_acknowledged_by": string | null,"cancellation_requires_ack": boolean,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string,"current_revision_id": string | null,"current_version": number,"id": string,"idempotency_key": string,"order_number": string,"ordering_store_id": string,"pickup_store_id": string,"rejected_at": string | null,"rejected_by": string | null,"rejection_reason": string | null,"status": Database["public"]['Enums']["order_status"],"updated_at": string,"can_read_order": boolean | null
                  }
                  ComputedFields: "can_read_order"
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"accepted_revision_id"?: string | null,"campaign_id"?: string | null,"cancellation_acknowledged_at"?: string | null,"cancellation_acknowledged_by"?: string | null,"cancellation_requires_ack"?: boolean,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by": string,"current_revision_id"?: string | null,"current_version"?: number,"id"?: string,"idempotency_key": string,"order_number"?: string,"ordering_store_id": string,"pickup_store_id": string,"rejected_at"?: string | null,"rejected_by"?: string | null,"rejection_reason"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"accepted_revision_id"?: string | null,"campaign_id"?: string | null,"cancellation_acknowledged_at"?: string | null,"cancellation_acknowledged_by"?: string | null,"cancellation_requires_ack"?: boolean,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string,"current_revision_id"?: string | null,"current_version"?: number,"id"?: string,"idempotency_key"?: string,"order_number"?: string,"ordering_store_id"?: string,"pickup_store_id"?: string,"rejected_at"?: string | null,"rejected_by"?: string | null,"rejection_reason"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_accepted_revision_fk"
      columns: ["accepted_revision_id"]
isOneToOne: false
      referencedRelation: "order_revisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "seasonal_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_current_revision_fk"
      columns: ["current_revision_id"]
isOneToOne: false
      referencedRelation: "order_revisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_ordering_store_id_fkey"
      columns: ["ordering_store_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_pickup_store_id_fkey"
      columns: ["pickup_store_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"pickup_windows": {
                  Row: {
                    "active": boolean,"closes_at": string,"id": string,"location_id": string,"opens_at": string,"slot_minutes": number,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"closes_at": string,"id"?: string,"location_id": string,"opens_at": string,"slot_minutes"?: number,"weekday": number
                  }
                  Update: {
                    "active"?: boolean,"closes_at"?: string,"id"?: string,"location_id"?: string,"opens_at"?: string,"slot_minutes"?: number,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pickup_windows_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"product_categories": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name": string,"position"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"products": {
                  Row: {
                    "active": boolean,"category_id": string,"created_at": string,"description": string,"id": string,"minimum_quantity": number,"name": string,"position": number,"quantity_step": number,"requires_note": boolean,"unit_label": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category_id": string,"created_at"?: string,"description"?: string,"id"?: string,"minimum_quantity"?: number,"name": string,"position"?: number,"quantity_step"?: number,"requires_note"?: boolean,"unit_label"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"category_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"minimum_quantity"?: number,"name"?: string,"position"?: number,"quantity_step"?: number,"requires_note"?: boolean,"unit_label"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "product_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"created_at": string,"full_name": string,"id": string,"location_id": string | null,"role": Database["public"]['Enums']["app_role"] | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"full_name"?: string,"id": string,"location_id"?: string | null,"role"?: Database["public"]['Enums']["app_role"] | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"full_name"?: string,"id"?: string,"location_id"?: string | null,"role"?: Database["public"]['Enums']["app_role"] | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth_key": string,"created_at": string,"endpoint": string,"id": string,"last_seen_at": string,"p256dh": string,"user_agent": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_key": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_seen_at"?: string,"p256dh": string,"user_agent"?: string,"user_id": string
                  }
                  Update: {
                    "auth_key"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_seen_at"?: string,"p256dh"?: string,"user_agent"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"seasonal_campaigns": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"description": string,"id": string,"name": string,"ordering_closes_at": string,"ordering_opens_at": string,"slug": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"name": string,"ordering_closes_at": string,"ordering_opens_at": string,"slug": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"name"?: string,"ordering_closes_at"?: string,"ordering_opens_at"?: string,"slug"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [

                  ]
                },"seasonal_pickup_slots": {
                  Row: {
                    "active": boolean,"campaign_id": string,"closes_at": string,"created_at": string,"id": string,"location_id": string,"opens_at": string,"pickup_date": string,"slot_minutes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"campaign_id": string,"closes_at": string,"created_at"?: string,"id"?: string,"location_id": string,"opens_at": string,"pickup_date": string,"slot_minutes"?: number
                  }
                  Update: {
                    "active"?: boolean,"campaign_id"?: string,"closes_at"?: string,"created_at"?: string,"id"?: string,"location_id"?: string,"opens_at"?: string,"pickup_date"?: string,"slot_minutes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "seasonal_pickup_slots_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "seasonal_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seasonal_pickup_slots_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"seasonal_products": {
                  Row: {
                    "active": boolean,"campaign_id": string,"created_at": string,"description": string,"id": string,"minimum_quantity": number,"name": string,"position": number,"quantity_step": number,"requires_note": boolean,"stock_limit": number | null,"unit_label": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"campaign_id": string,"created_at"?: string,"description"?: string,"id"?: string,"minimum_quantity"?: number,"name": string,"position"?: number,"quantity_step"?: number,"requires_note"?: boolean,"stock_limit"?: number | null,"unit_label"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"campaign_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"minimum_quantity"?: number,"name"?: string,"position"?: number,"quantity_step"?: number,"requires_note"?: boolean,"stock_limit"?: number | null,"unit_label"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seasonal_products_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "seasonal_campaigns"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_order":
{ Args: { "p_expected_version": number,"p_order_id": string }; Returns: undefined
                           },
"acknowledge_cancellation":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"anonymize_expired_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"assert_order_details":
{ Args: { "p_customer_email": string,"p_customer_name": string,"p_customer_phone": string,"p_general_notes": string,"p_pickup_at": string,"p_pickup_store_id": string }; Returns: undefined
                           },
"assert_valid_items":
{ Args: { "p_items": Json }; Returns: undefined
                           },
"assert_valid_seasonal_items":
{ Args: { "p_campaign_id": string,"p_items": Json }; Returns: undefined
                           },
"can_read_order":
{ Args: { "target": Omit<Database["public"]['Tables']["orders"]['Row'], Database["public"]['Tables']["orders"]['ComputedFields']> }; Returns: boolean
                           },
"cancel_order":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"claim_notification_jobs":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"channel": Database["public"]['Enums']["notification_channel"],
"created_at": string,
"id": string,
"kind": Database["public"]['Enums']["notification_kind"],
"last_error": string | null,
"next_attempt_at": string,
"order_id": string | null,
"provider_message_id": string | null,
"recipient": string | null,
"revision_version": number | null,
"sent_at": string | null,
"status": Database["public"]['Enums']["delivery_status"]
            }[]
                          SetofOptions: {
        from: "*"
        to: "notification_outbox"
        isOneToOne: false
        isSetofReturn: true
      } },
"create_order":
{ Args: { "p_customer_email": string,"p_customer_name": string,"p_customer_phone": string,"p_general_notes": string,"p_idempotency_key": string,"p_items": Json,"p_ordering_store_id"?: string,"p_pickup_at": string,"p_pickup_store_id": string }; Returns: string
                           },
"create_seasonal_order":
{ Args: { "p_campaign_id": string,"p_customer_email": string,"p_customer_name": string,"p_customer_phone": string,"p_general_notes": string,"p_idempotency_key": string,"p_items": Json,"p_ordering_store_id"?: string,"p_pickup_at": string,"p_pickup_slot_id": string }; Returns: string
                           },
"current_profile_location":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_profile_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"insert_revision_items":
{ Args: { "p_items": Json,"p_revision_id": string }; Returns: undefined
                           },
"insert_seasonal_revision_items":
{ Args: { "p_campaign_id": string,"p_items": Json,"p_revision_id": string }; Returns: undefined
                           },
"reject_order":
{ Args: { "p_expected_version": number,"p_order_id": string,"p_reason"?: string }; Returns: undefined
                           },
"submit_order_revision":
{ Args: { "p_customer_email": string,"p_customer_name": string,"p_customer_phone": string,"p_general_notes": string,"p_items": Json,"p_order_id": string,"p_pickup_at": string,"p_pickup_store_id": string }; Returns: number
                           }
          }
          Enums: {
            "app_role": "admin"|"store"|"kitchen","delivery_status": "pending"|"processing"|"sent"|"failed"|"dead","location_type": "store"|"kitchen","notification_channel": "email"|"push","notification_kind": "new_order"|"revised_order"|"order_accepted"|"order_updated_accepted"|"order_rejected"|"order_cancelled"|"accepted_order_cancelled","order_event_type": "created"|"revised"|"accepted"|"rejected"|"cancelled"|"cancellation_acknowledged","order_status": "pending"|"accepted"|"rejected"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "app_role": ["admin", "store", "kitchen"],"delivery_status": ["pending", "processing", "sent", "failed", "dead"],"location_type": ["store", "kitchen"],"notification_channel": ["email", "push"],"notification_kind": ["new_order", "revised_order", "order_accepted", "order_updated_accepted", "order_rejected", "order_cancelled", "accepted_order_cancelled"],"order_event_type": ["created", "revised", "accepted", "rejected", "cancelled", "cancellation_acknowledged"],"order_status": ["pending", "accepted", "rejected", "cancelled"]
          }
        }
} as const
