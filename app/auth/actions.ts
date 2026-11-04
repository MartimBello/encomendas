"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { databaseError, type ActionResult } from "@/lib/validation";

export async function signInAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.email(), password: z.string().min(8) }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, message: "Confirme o email e a palavra-passe." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "O Supabase ainda não está configurado." };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: "Email ou palavra-passe incorretos." };
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/login");
}

export async function requestPasswordAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: "Indique um email válido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "O Supabase ainda não está configurado." };
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000"}/auth/callback?next=/auth/definir-password` });
  return error ? { ok: false, message: databaseError(error) } : { ok: true, message: "Se a conta existir, receberá as instruções por email." };
}

export async function updatePasswordAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = z.object({ password: z.string().min(8), confirm: z.string() }).refine((value) => value.password === value.confirm).safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!result.success) return { ok: false, message: "As palavras-passe devem coincidir e ter pelo menos 8 caracteres." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "O Supabase ainda não está configurado." };
  const { error } = await supabase.auth.updateUser({ password: result.data.password });
  if (error) return { ok: false, message: databaseError(error) };
  redirect("/");
}
