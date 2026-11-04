import { getOrderFormOptions } from "@/lib/data";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";

export default async function NewOrderPage() { const options = await getOrderFormOptions(); return <><PageHeader title="Nova encomenda" description="Preencha os dados obrigatórios. O rascunho fica protegido neste separador durante 24 horas." /><OrderForm {...options} /></>; }
