import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Database, ShieldCheck, Tablet } from "lucide-react";
import { getCurrentProfile, homeForRole } from "@/lib/auth";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

async function Entry() {
  const { configured } = getSupabaseEnv();
  if (!configured) {
    return <main className="mx-auto flex min-h-dvh max-w-4xl items-center px-5 py-12"><Card className="w-full overflow-hidden"><div className="h-2 bg-primary" /><CardHeader className="pb-2 text-center"><div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary text-white"><Tablet className="size-7" /></div><CardTitle className="text-3xl">Encomendas</CardTitle><p className="text-muted-foreground">A aplicação está pronta para ligar ao Supabase local.</p></CardHeader><CardContent className="grid gap-3 pt-4 md:grid-cols-3">{[[Database, "1. Iniciar dados", "Execute npm run supabase:start e copie as chaves apresentadas."], [ShieldCheck, "2. Configurar ambiente", "Crie .env.local a partir de .env.example."], [Tablet, "3. Abrir a aplicação", "Reinicie npm run dev e entre com uma conta ativa."]].map(([Icon, title, body]) => { const Glyph = Icon as typeof Database; return <div key={String(title)} className="rounded-xl bg-muted p-4"><Glyph className="mb-3 size-5 text-primary" /><h2 className="font-semibold">{String(title)}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{String(body)}</p></div>; })}</CardContent></Card></main>;
  }
  const profile = await getCurrentProfile();
  redirect(profile ? homeForRole(profile.role) : "/login");
}

export default function Home() {
  return <Suspense fallback={<main className="mx-auto max-w-4xl p-8"><Skeleton className="h-96 w-full" /></main>}><Entry /></Suspense>;
}
