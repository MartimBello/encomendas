import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";

export async function GET(_request: Request, context: RouteContext<"/admin/sazonais/[campaignId]/export">) {
  await requireProfile(["admin"]);
  const { campaignId } = await context.params;
  if (!z.uuid().safeParse(campaignId).success) return new Response("Campanha inválida.", { status: 400 });
  redirect(`/admin/sazonais/${campaignId}/relatorios`);
}
