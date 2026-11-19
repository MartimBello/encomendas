"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download, FileText, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  defaultSeasonalReportDefinition,
  reportGeneratedLabel,
  seasonalReportDefinitionSchema,
  type SeasonalReportDefinition,
  type SeasonalReportMode,
  type SeasonalReportPreview,
} from "@/lib/seasonal-reports";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/empty-state";

type ProductOption = { id: string; name: string };

function OrderSheetPreview({ report }: { report: SeasonalReportPreview }) {
  const sheet = report.orderSheets[0];
  if (!sheet) return <EmptyState title="Sem encomendas aceites" description="Ainda não existem encomendas aceites para exportar nesta campanha." icon={FileText} />;

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-xl font-semibold">Encomenda {sheet.orderNumber}</h3><p className="text-sm text-muted-foreground">{sheet.orderingStore}</p></div>
      <Badge variant="outline">Versão {sheet.version}</Badge>
    </div>
    <dl className="grid gap-4 rounded-xl bg-muted p-4 sm:grid-cols-2">
      <div><dt className="text-xs font-medium text-muted-foreground">Serviço</dt><dd className="font-medium">{sheet.fulfillmentLabel}</dd></div>
      <div><dt className="text-xs font-medium text-muted-foreground">Data e hora</dt><dd className="font-medium">{sheet.serviceDate} · {sheet.serviceTime}</dd></div>
      <div><dt className="text-xs font-medium text-muted-foreground">Cliente</dt><dd className="font-medium">{sheet.customerName}</dd></div>
      <div><dt className="text-xs font-medium text-muted-foreground">Telefone</dt><dd className="font-medium">{sheet.customerPhone}</dd></div>
      {sheet.deliveryAddress && <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Morada de entrega</dt><dd className="font-medium">{sheet.deliveryAddress}</dd></div>}
    </dl>
    <div className="overflow-hidden rounded-xl border">
      <Table><TableHeader><TableRow><TableHead>Artigo</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Peso total</TableHead></TableRow></TableHeader>
        <TableBody>{sheet.items.map((item) => <TableRow key={item.id}><TableCell>{item.product}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{item.totalWeight || "-"}</TableCell></TableRow>)}</TableBody>
      </Table>
    </div>
  </div>;
}

function ProductTotalsPreview({ report }: { report: SeasonalReportPreview }) {
  if (!report.rowCount) return <EmptyState title="Sem artigos para apresentar" description="Não existem encomendas aceites com os artigos selecionados." icon={FileText} />;
  const summed = report.productAggregation === "sum";
  return <div className="flex flex-col gap-5">
    {report.productSections.map((section) => <section key={`${section.key}-${section.continued ? "continued" : "start"}`} className="flex flex-col gap-2">
      {section.title && <h3 className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold">{section.title}{section.continued ? " (continuação)" : ""}</h3>}
      <div className="overflow-hidden rounded-xl border">
        <Table><TableHeader><TableRow><TableHead>Artigo</TableHead><TableHead className={summed ? "text-right" : undefined}>{summed ? "Quantidade total" : "Quantidades por encomenda"}</TableHead></TableRow></TableHeader>
          <TableBody>{section.rows.map((row) => <TableRow key={row.id}><TableCell className="align-top">{row.product}</TableCell><TableCell className={summed ? "text-right" : undefined}>{summed ? row.quantity : <ul className="flex flex-col gap-1">{row.orderQuantities.map((entry) => <li key={entry.orderId}><span className="font-medium">{entry.clientName}</span> · {entry.quantity}</li>)}</ul>}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
    </section>)}
  </div>;
}

function ReportPreview({ report, loading, onPage }: { report: SeasonalReportPreview | null; loading: boolean; onPage: (page: number) => void }) {
  if (!report && loading) return <Card><CardContent className="grid min-h-80 place-items-center"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" />A preparar pré-visualização…</p></CardContent></Card>;
  if (!report) return null;
  return <Card className="min-w-0 overflow-hidden">
    <CardHeader className="border-b bg-muted/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle>{report.title}</CardTitle><CardDescription>Gerado em {reportGeneratedLabel(report.generatedAt)} · {report.summary}</CardDescription></div>
        {loading && <LoaderCircle className="animate-spin text-muted-foreground" />}
      </div>
    </CardHeader>
    <CardContent className="p-5">{report.mode === "order_sheets" ? <OrderSheetPreview report={report} /> : <ProductTotalsPreview report={report} />}</CardContent>
    <CardFooter className="justify-between border-t pt-5">
      <p className="text-sm text-muted-foreground">Página {report.page} de {report.pageCount}</p>
      <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={report.page <= 1 || loading} onClick={() => onPage(report.page - 1)}><ArrowLeft data-icon="inline-start" />Anterior</Button><Button type="button" variant="outline" size="sm" disabled={report.page >= report.pageCount || loading} onClick={() => onPage(report.page + 1)}>Seguinte<ArrowRight data-icon="inline-end" /></Button></div>
    </CardFooter>
  </Card>;
}

export function SeasonalReportBuilder({ campaignId, initialPreset, products }: {
  campaignId: string;
  initialPreset?: string;
  products: ProductOption[];
}) {
  const productFieldId = useId();
  const [definition, setDefinition] = useState<SeasonalReportDefinition>(() => defaultSeasonalReportDefinition(initialPreset));
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<SeasonalReportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const validation = useMemo(() => seasonalReportDefinitionSchema.safeParse(definition), [definition]);

  useEffect(() => {
    if (!validation.success) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/admin/sazonais/${campaignId}/relatorios/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ definition, page }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível preparar a pré-visualização.");
        setPreview(result);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Não foi possível preparar a pré-visualização.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [campaignId, definition, page, validation.success]);

  function changeDefinition(next: SeasonalReportDefinition | ((current: SeasonalReportDefinition) => SeasonalReportDefinition)) {
    setPage(1);
    setDefinition((current) => typeof next === "function" ? next(current) : next);
  }

  function changeMode(mode: SeasonalReportMode) {
    changeDefinition(mode === "order_sheets" ? defaultSeasonalReportDefinition("order-sheets") : defaultSeasonalReportDefinition("product-totals"));
  }

  function toggleProduct(productId: string, checked: boolean) {
    changeDefinition((current) => ({
      ...current,
      productIds: checked ? [...current.productIds, productId] : current.productIds.filter((id) => id !== productId),
    }));
  }

  async function downloadPdf() {
    if (!validation.success || !preview?.rowCount) return;
    setDownloading(true);
    try {
      const response = await fetch(`/admin/sazonais/${campaignId}/relatorios/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(definition),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Não foi possível gerar o PDF.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "relatorio-sazonal.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("PDF gerado com sucesso.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Não foi possível gerar o PDF.");
    } finally {
      setDownloading(false);
    }
  }

  const validationError = validation.success ? "" : validation.error.issues[0]?.message ?? "Configuração inválida.";
  const shownError = validationError || error;
  const isLoading = validation.success && loading;

  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
    <Card>
      <CardHeader><CardTitle>O que pretende exportar?</CardTitle><CardDescription>Os PDFs incluem apenas encomendas aceites.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FieldSet><FieldLegend>Tipo de PDF</FieldLegend><ToggleGroup type="single" value={definition.mode} onValueChange={(value) => value && changeMode(value as SeasonalReportMode)} variant="outline" className="grid w-full grid-cols-2"><ToggleGroupItem value="order_sheets">Encomendas</ToggleGroupItem><ToggleGroupItem value="product_totals">Artigos</ToggleGroupItem></ToggleGroup></FieldSet>

        {definition.mode === "order_sheets" ? <Alert><FileText /><AlertTitle>Uma folha por encomenda</AlertTitle><AlertDescription>Cada folha inclui artigos e quantidades, data e hora, nome e telefone do cliente e, nas entregas, a morada.</AlertDescription></Alert> : <FieldGroup>
          <FieldSet><FieldLegend>Apresentação das quantidades</FieldLegend><ToggleGroup type="single" value={definition.productAggregation} onValueChange={(value) => value && changeDefinition((current) => ({ ...current, productAggregation: value as "sum" | "order_list" }))} variant="outline" className="grid w-full grid-cols-2"><ToggleGroupItem value="sum">Somar</ToggleGroupItem><ToggleGroupItem value="order_list">Listar</ToggleGroupItem></ToggleGroup></FieldSet>
          <Field orientation="horizontal"><Checkbox id="separate-by-day" checked={definition.separateByDay} onCheckedChange={(checked) => changeDefinition((current) => ({ ...current, separateByDay: checked === true }))} /><FieldLabel htmlFor="separate-by-day" className="font-normal">Separar os totais por dia</FieldLabel></Field>
          <FieldSet><FieldLegend>Artigos a incluir</FieldLegend><p className="text-sm text-muted-foreground">Sem seleção, são incluídos todos os artigos.</p><FieldGroup className="gap-2">{products.map((product) => <Field key={product.id} orientation="horizontal"><Checkbox id={`${productFieldId}-${product.id}`} checked={definition.productIds.includes(product.id)} onCheckedChange={(checked) => toggleProduct(product.id, checked === true)} /><FieldLabel htmlFor={`${productFieldId}-${product.id}`} className="font-normal">{product.name}</FieldLabel></Field>)}</FieldGroup></FieldSet>
        </FieldGroup>}

        {shownError && <Alert><AlertTitle>Não foi possível preparar o PDF</AlertTitle><AlertDescription>{shownError}</AlertDescription></Alert>}
      </CardContent>
      <CardFooter className="border-t pt-5"><Button className="w-full" disabled={!validation.success || !preview?.rowCount || downloading || isLoading} onClick={downloadPdf}>{downloading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}Descarregar PDF</Button></CardFooter>
    </Card>
    <div className="min-w-0" aria-live="polite"><ReportPreview report={preview} loading={isLoading} onPage={setPage} /></div>
  </div>;
}
