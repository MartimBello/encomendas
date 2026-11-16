import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import type { SeasonalCampaign } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function SeasonalExportPanel({ campaign }: { campaign: Pick<SeasonalCampaign, "id" | "name"> }) {
  const base = `/admin/sazonais/${campaign.id}/export`;
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><FileSpreadsheet />Exportações</CardTitle>
      <CardDescription>Descarregue os relatórios mais usados ou configure um CSV para esta campanha.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href={`${base}?report=products&status=accepted&group_date=on&store=none`}><Download data-icon="inline-start" />Artigos por data</Link></Button>
        <Button asChild variant="outline"><Link href={`${base}?report=products&status=accepted&group_date=on&store=ordering`}><Download data-icon="inline-start" />Artigos por loja e data</Link></Button>
        <Button asChild variant="outline"><Link href={`${base}?report=orders&status=all&store=none`}><Download data-icon="inline-start" />Todas as encomendas</Link></Button>
      </div>
      <form action={base} method="get" className="rounded-xl border bg-muted/30 p-4">
        <FieldGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="export-report">Conteúdo</FieldLabel>
            <NativeSelect id="export-report" name="report" defaultValue="products">
              <NativeSelectOption value="products">Quantidades por artigo</NativeSelectOption>
              <NativeSelectOption value="orders">Todas as linhas das encomendas</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="export-status">Estados incluídos</FieldLabel>
            <NativeSelect id="export-status" name="status" defaultValue="accepted">
              <NativeSelectOption value="accepted">Apenas aceites</NativeSelectOption>
              <NativeSelectOption value="all">Todos os estados</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="export-store">Separar por loja</FieldLabel>
            <NativeSelect id="export-store" name="store" defaultValue="none">
              <NativeSelectOption value="none">Não separar</NativeSelectOption>
              <NativeSelectOption value="ordering">Loja de origem</NativeSelectOption>
              <NativeSelectOption value="pickup">Loja de levantamento</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field className="justify-end">
            <div className="flex min-h-12 items-center gap-2">
              <Checkbox id="export-group-date" name="group_date" value="on" defaultChecked />
              <FieldLabel htmlFor="export-group-date">Separar por data de levantamento</FieldLabel>
            </div>
          </Field>
        </FieldGroup>
        <Button type="submit" className="mt-4"><Download data-icon="inline-start" />Gerar CSV configurado</Button>
      </form>
    </CardContent>
  </Card>;
}
