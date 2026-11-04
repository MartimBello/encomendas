"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const { url, publishableKey, configured } = getSupabaseEnv();
  if (!configured) return null;
  client ??= createBrowserClient<Database>(url!, publishableKey!);
  return client;
}
