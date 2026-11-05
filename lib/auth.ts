import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/domain";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, location_id, active, location:locations(id,name,kind,address,active)")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!data?.role) return null;
  return data as unknown as Profile;
}

export async function requireProfile(roles?: AppRole[]) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (roles && !roles.includes(profile.role)) redirect("/sem-acesso");
  return profile;
}

export function homeForRole(role: AppRole) {
  if (role === "admin") return "/admin";
  if (role === "kitchen") return "/cozinha";
  return "/loja/encomendas";
}
