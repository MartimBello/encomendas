import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import type { SeasonalCampaign } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SeasonalExportPanel({ campaign }: { campaign: Pick<SeasonalCampaign, "id" | "name"> }) {
  const base = `/admin/sazonais/${campaign.id}/relatorios`;
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><FileText />Exportar PDF</CardTitle>
      <CardDescription>Consulte e exporte os relatórios desta campanha.</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild><Link href={base}>Relatórios de encomendas<ArrowRight data-icon="inline-end" /></Link></Button>
    </CardContent>
  </Card>;
}
