import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { getSeasonalCampaign, getSeasonalExportOrders } from "@/lib/data";
import { buildSeasonalExport, exportTableToCsv } from "@/lib/seasonal-exports";

const optionsSchema = z.object({
  report: z.enum(["orders", "products"]).default("products"),
  status: z.enum(["accepted", "all"]).default("accepted"),
  store: z.enum(["none", "ordering", "pickup"]).default("none"),
  group_date: z.enum(["on"]).optional(),
});

export async function GET(request: Request, context: RouteContext<"/admin/sazonais/[campaignId]/export">) {
  await requireProfile(["admin"]);
  const { campaignId } = await context.params;
  if (!z.uuid().safeParse(campaignId).success) return new Response("Campanha inválida.", { status: 400 });

  const parsed = optionsSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return new Response("Configuração de exportação inválida.", { status: 400 });

  const [campaign, orders] = await Promise.all([getSeasonalCampaign(campaignId), getSeasonalExportOrders(campaignId)]);
  if (!campaign) return new Response("Campanha não encontrada.", { status: 404 });

  const table = buildSeasonalExport(orders, {
    report: parsed.data.report,
    status: parsed.data.status,
    store: parsed.data.store,
    groupByDate: parsed.data.group_date === "on",
  });
  const csv = exportTableToCsv(table);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${campaign.slug}-${table.suffix}-${date}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
