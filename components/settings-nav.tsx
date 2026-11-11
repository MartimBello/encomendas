"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, ClipboardCheck, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsLinks = [
  { href: "/admin/definicoes/regras", label: "Regras", icon: ClipboardCheck },
  { href: "/admin/definicoes/locais", label: "Locais", icon: MapPinned },
  { href: "/admin/definicoes/retencao", label: "Retenção", icon: Archive },
];

export function SettingsNav() {
  const pathname = usePathname();

  return <nav aria-label="Secções das definições" className="mb-5 flex gap-2 overflow-x-auto pb-1 md:hidden">
    {settingsLinks.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);

      return <Link key={href} href={href} className={cn("flex min-h-10 flex-none items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" />{label}</Link>;
    })}
  </nav>;
}
