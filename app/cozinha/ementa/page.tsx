import { AlertCircle, RefreshCw } from "lucide-react";
import { KitchenWeeklyMenu } from "@/components/kitchen-weekly-menu";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getWeeklyMenuOrdersForKitchen } from "@/lib/data";
import { getWeeklyMenu } from "@/lib/weekly-menu";

async function loadPageData() {
  try {
    const menu = await getWeeklyMenu();
    const { orders, stores } = await getWeeklyMenuOrdersForKitchen(menu.dataReferencia);
    return { menu, orders, stores };
  } catch {
    return null;
  }
}

export default async function KitchenWeeklyMenuPage() {
  const data = await loadPageData();
  if (!data) {
    return <>
      <PageHeader title="Ementa das lojas" description="Quantidades semanais pedidas à cozinha, separadas por loja." />
      <Alert className="border-amber-300 bg-amber-50 text-amber-950">
        <AlertCircle className="mb-2 size-5" />
        <AlertTitle>Não foi possível carregar as encomendas</AlertTitle>
        <AlertDescription>Verifique a ligação ao sistema central e tente novamente.</AlertDescription>
        <Button asChild variant="outline" className="mt-4"><a href="/cozinha/ementa"><RefreshCw />Tentar novamente</a></Button>
      </Alert>
    </>;
  }

  return <>
    <PageHeader title="Ementa das lojas" description="Consulte as quantidades de cada dia, mantendo a encomenda de cada loja separada." />
    <KitchenWeeklyMenu menu={data.menu} orders={data.orders} stores={data.stores} />
  </>;
}
