"use client";

import { useActionState } from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle } from "lucide-react";
import { requestPasswordAction, updatePasswordAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm({ mode }: { mode: "request" | "update" }) {
  const [state, action, pending] = useActionState(mode === "request" ? requestPasswordAction : updatePasswordAction, { ok: false as const, message: "" });
  return <main className="flex min-h-dvh items-center justify-center px-5 py-10"><Card className="w-full max-w-md"><CardHeader><div className="mb-3 grid size-12 place-items-center rounded-xl bg-secondary"><KeyRound /></div><CardTitle>{mode === "request" ? "Recuperar acesso" : "Definir palavra-passe"}</CardTitle><CardDescription>{mode === "request" ? "Enviaremos um link seguro para o seu email." : "Escolha uma palavra-passe com pelo menos 8 caracteres."}</CardDescription></CardHeader><CardContent><form action={action} className="space-y-4">{mode === "request" ? <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div> : <><div className="space-y-2"><Label htmlFor="password">Nova palavra-passe</Label><Input id="password" name="password" type="password" minLength={8} required /></div><div className="space-y-2"><Label htmlFor="confirm">Confirmar</Label><Input id="confirm" name="confirm" type="password" minLength={8} required /></div></>}{state.message && <p className={state.ok ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-xl bg-red-50 p-3 text-sm text-red-800"}>{state.message}</p>}<Button className="w-full" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}{mode === "request" ? "Enviar instruções" : "Guardar palavra-passe"}</Button><Button asChild variant="ghost" className="w-full"><Link href="/login">Voltar ao início de sessão</Link></Button></form></CardContent></Card></main>;
}
