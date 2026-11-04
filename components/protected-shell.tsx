import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import type { AppRole } from "@/lib/domain";

export async function ProtectedShell({ role, children }: { role: AppRole; children: React.ReactNode }) {
  const profile = await requireProfile([role]);
  return <AppShell profile={profile}>{children}</AppShell>;
}
