import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function createClient() {
  const { url, publishableKey, configured } = getSupabaseEnv();
  if (!configured) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(url!, publishableKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes them instead.
        }
      },
    },
  });
}
