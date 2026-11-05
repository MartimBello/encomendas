import { Suspense } from "react";
import { ProtectedShell } from "@/components/protected-shell";
import { Skeleton } from "@/components/ui/skeleton";
export const dynamic = "force-dynamic";
export default function StoreLayout({ children }: { children: React.ReactNode }) { return <Suspense fallback={<Skeleton className="m-8 h-96" />}><ProtectedShell role="store">{children}</ProtectedShell></Suspense>; }
