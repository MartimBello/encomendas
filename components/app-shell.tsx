"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, ChefHat, ClipboardList, Gift, LogOut, PackageSearch, Settings, ShoppingBag, Store, Users } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import type { AppRole, Profile } from "@/lib/domain";
import { roleLabels } from "@/lib/domain";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PwaInstall } from "@/components/pwa-install";

const navigation: Record<AppRole, { href: string; label: string; icon: typeof Store }[]> = {
  store: [
    { href: "/loja/encomendas", label: "Encomendas", icon: ClipboardList },
    { href: "/loja/encomendas/nova", label: "Nova", icon: ShoppingBag },
    { href: "/loja/sazonais", label: "Sazonais", icon: Gift },
  ],
  kitchen: [
    { href: "/cozinha", label: "Fila da cozinha", icon: ChefHat },
    { href: "/cozinha/sazonais", label: "Sazonais", icon: Gift },
  ],
  admin: [
    { href: "/admin", label: "Resumo", icon: PackageSearch },
    { href: "/admin/utilizadores", label: "Equipa", icon: Users },
    { href: "/admin/catalogo", label: "Catálogo", icon: ShoppingBag },
    { href: "/admin/sazonais", label: "Sazonais", icon: Gift },
    { href: "/admin/definicoes", label: "Definições", icon: Settings },
    { href: "/admin/notificacoes", label: "Entregas", icon: BellRing },
  ],
};

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const links = navigation[profile.role];
  const isActive = (href: string) => pathname === href || (href !== "/admin" && href !== "/cozinha" && pathname.startsWith(`${href}/`));
  const clearDrafts = () => Object.keys(sessionStorage).filter((key) => key.startsWith("encomendas:draft:")).forEach((key) => sessionStorage.removeItem(key));
  return <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
    <aside className="hidden border-r bg-card md:flex md:flex-col md:sticky md:top-0 md:h-dvh">
      <div className="flex h-20 items-center gap-3 border-b px-5"><span className="grid size-11 place-items-center rounded-xl bg-primary text-white"><ShoppingBag /></span><div><p className="font-semibold">Encomendas</p><p className="text-xs text-muted-foreground">{roleLabels[profile.role]}</p></div></div>
      <nav className="flex-1 space-y-1 p-3">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", isActive(href) ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-5" />{label}</Link>)}</nav>
      <div className="border-t p-4"><div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-secondary text-sm font-bold">{initials(profile.full_name)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile.full_name}</p><p className="truncate text-xs text-muted-foreground">{profile.location?.name || roleLabels[profile.role]}</p></div></div><form action={signOutAction} onSubmit={clearDrafts}><Button variant="ghost" className="w-full justify-start"><LogOut /> Terminar sessão</Button></form></div>
    </aside>
    <div className="min-w-0 pb-24 md:pb-0"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden"><div className="flex items-center gap-2 font-semibold"><span className="grid size-9 place-items-center rounded-lg bg-primary text-white"><ShoppingBag className="size-5" /></span> Encomendas</div><span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold">{initials(profile.full_name)}</span></header><main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8"><div className="no-print mb-4 flex justify-end"><PwaInstall /></div>{children}</main></div>
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t bg-card px-2 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,.06)] md:hidden">{links.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium", isActive(href) ? "text-primary" : "text-muted-foreground")}><Icon className="size-5" /><span className="truncate">{label}</span></Link>)}<form action={signOutAction} onSubmit={clearDrafts} className="flex-1"><button className="flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium text-muted-foreground"><LogOut className="size-5" />Sair</button></form></nav>
  </div>;
}
