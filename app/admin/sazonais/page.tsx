import Link from "next/link";
import { Pencil } from "lucide-react";
import { getSeasonalCampaigns } from "@/lib/data";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { SeasonalCampaignCreateDialog } from "@/components/seasonal-admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function periodState(opens: string, closes: string) {
  const now = Date.now();
  if (now < new Date(opens).getTime()) return { label: "Agendada", variant: "info" as const };
  if (now > new Date(closes).getTime()) return { label: "Encerrada", variant: "cancelled" as const };
  return { label: "A aceitar", variant: "accepted" as const };
}

export default async function SeasonalAdminPage() {
  const campaigns = await getSeasonalCampaigns(true);

  return <>
    <PageHeader
      title="Campanhas sazonais"
      description="Crie campanhas para Natal, Páscoa e outras épocas e abra cada campanha para configurar todos os detalhes."
      actions={<SeasonalCampaignCreateDialog />}
    />
    <Card>
      <CardHeader>
        <CardTitle>Campanhas configuradas</CardTitle>
        <CardDescription>O menu, os dias de levantamento e o período de aceitação são geridos dentro de cada campanha.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Campanha</TableHead><TableHead>Aceitação de encomendas</TableHead><TableHead>Configuração</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {campaigns.map((campaign) => {
              const state = periodState(campaign.ordering_opens_at, campaign.ordering_closes_at);
              return <TableRow key={campaign.id}>
                <TableCell><p className="font-medium">{campaign.name}</p><p className="text-xs text-muted-foreground">{campaign.description || "Sem descrição"}</p></TableCell>
                <TableCell><p>{formatDateTime(campaign.ordering_opens_at)}</p><p className="text-xs text-muted-foreground">até {formatDateTime(campaign.ordering_closes_at)}</p></TableCell>
                <TableCell>{campaign.products?.length ?? 0} artigos · {campaign.pickup_slots?.length ?? 0} levantamentos</TableCell>
                <TableCell><Badge variant={campaign.active ? state.variant : "outline"}>{campaign.active ? state.label : "Inativa"}</Badge></TableCell>
                <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link href={`/admin/sazonais/${campaign.id}`}><Pencil data-icon="inline-start" />Editar</Link></Button></TableCell>
              </TableRow>;
            })}
            {!campaigns.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Ainda não existem campanhas sazonais.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </>;
}
