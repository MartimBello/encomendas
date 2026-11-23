import { AlertCircle, RefreshCw } from "lucide-react";
import { WeeklyMenuOrderForm } from "@/components/weekly-menu-order-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getWeeklyMenuOrder } from "@/lib/data";
import { getWeeklyMenu } from "@/lib/weekly-menu";

async function loadPageData() {
  try {
    const menu = await getWeeklyMenu();
    const order = await getWeeklyMenuOrder(menu.dataReferencia);
    return { menu, order };
  } catch {
    return null;
  }
}

export default async function WeeklyMenuPage() {
  const data = await loadPageData();
  if (!data) {
    return <>
      <PageHeader title="Ementa semanal" description="Encomenda diária da loja à cozinha." />
      <Alert className="border-amber-300 bg-amber-50 text-amber-950">
        <AlertCircle className="mb-2 size-5" />
        <AlertTitle>Não foi possível carregar a ementa</AlertTitle>
        <AlertDescription>Verifique a ligação ao sistema central e tente novamente.</AlertDescription>
        <Button asChild variant="outline" className="mt-4"><a href="/loja/ementa"><RefreshCw />Tentar novamente</a></Button>
      </Alert>
    </>;
  }

  return <>
    <PageHeader
      title="Ementa semanal"
      description="Indique as quantidades que a sua loja precisa para cada prato. Pode voltar e alterar a encomenda ao longo da semana."
    />
    <WeeklyMenuOrderForm menu={data.menu} savedOrder={data.order} />
  </>;
}
