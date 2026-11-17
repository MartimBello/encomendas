import { getOrderFormOptions } from "@/lib/data";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";

export default async function NewOrderPage() { const [options, profile] = await Promise.all([getOrderFormOptions(), requireProfile(["store"])]); return <><PageHeader title="Nova encomenda" description="Preencha os dados obrigatórios. O rascunho fica protegido neste separador durante 24 horas." /><OrderForm {...options} orderingStoreId={profile.location_id!} /></>; }
