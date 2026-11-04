"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LoaderCircle, LogIn } from "lucide-react";
import { signInAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm() {
  const [state, action, pending] = useActionState(signInAction, { ok: false as const, message: "" });
  return <form action={action} className="space-y-5"><div className="space-y-2"><Label htmlFor="email">Email profissional</Label><Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required autoFocus /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Palavra-passe</Label><Link href="/auth/recuperar" className="text-sm font-medium text-primary hover:underline">Recuperar acesso</Link></div><Input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>{state.message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.message}</p>}<Button className="w-full" size="lg" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <LogIn />} Entrar</Button><p className="text-center text-xs leading-relaxed text-muted-foreground">O acesso é exclusivo a colaboradores convidados pela administração.</p></form>;
}
