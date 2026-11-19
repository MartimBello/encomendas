import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { getSeasonalCampaign, getSeasonalExportOrders } from "@/lib/data";
import { buildSeasonalReport, paginateSeasonalReport, seasonalReportPreviewRequestSchema } from "@/lib/seasonal-reports";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: RouteContext<"/admin/sazonais/[campaignId]/relatorios/preview">) {
  await requireProfile(["admin"]);
  const { campaignId } = await context.params;
  if (!z.uuid().safeParse(campaignId).success) return error("Campanha inválida.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Pedido inválido.", 400);
  }
  const parsed = seasonalReportPreviewRequestSchema.safeParse(body);
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Configuração de relatório inválida.", 422);

  const [campaign, orders] = await Promise.all([getSeasonalCampaign(campaignId), getSeasonalExportOrders(campaignId)]);
  if (!campaign) return error("Campanha não encontrada.", 404);
  try {
    const report = buildSeasonalReport(campaign, orders, parsed.data.definition);
    return Response.json(paginateSeasonalReport(report, parsed.data.page), { headers: { "Cache-Control": "private, no-store" } });
  } catch (caught) {
    if (caught instanceof z.ZodError) return error(caught.message, 422);
    throw caught;
  }
}
