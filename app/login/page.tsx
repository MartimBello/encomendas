import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return <main className="grid min-h-dvh lg:grid-cols-[1.1fr_.9fr]"><section className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"><div className="flex items-center gap-3 text-lg font-semibold"><span className="grid size-11 place-items-center rounded-xl bg-white/15"><ShoppingBag /></span> Encomendas</div><div className="max-w-xl"><p className="mb-5 text-sm font-semibold uppercase tracking-[.2em] text-secondary">Da loja para a cozinha</p><h1 className="text-5xl font-semibold leading-[1.08]">Pedidos claros. Confirmações rápidas. Menos erros.</h1><p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">Registe encomendas no balcão e acompanhe a decisão da cozinha em tempo real.</p></div><p className="text-sm text-white/60">Aplicação interna · Portugal</p></section><section className="flex items-center justify-center px-5 py-10"><Card className="w-full max-w-md border-0 shadow-xl shadow-primary/10 sm:border"><CardHeader className="pb-5"><div className="mb-3 grid size-12 place-items-center rounded-xl bg-primary text-white lg:hidden"><ShoppingBag /></div><CardTitle className="text-2xl">Bem-vindo</CardTitle><CardDescription>Entre com a sua conta para continuar.</CardDescription></CardHeader><CardContent><AuthForm /></CardContent></Card></section></main>;
}
