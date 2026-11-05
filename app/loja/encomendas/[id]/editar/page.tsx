import { notFound } from "next/navigation";
import { getOrder, getOrderFormOptions } from "@/lib/data";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";

export default async function EditOrderPage({ params }: PageProps<"/loja/encomendas/[id]/editar">) { const { id } = await params; const [result, options] = await Promise.all([getOrder(id), getOrderFormOptions()]); if (!result?.order.revision || result.order.status === "cancelled" || result.order.campaign_id) notFound(); return <><PageHeader title={`Rever ${result.order.order_number}`} description="A alteração cria uma nova versão e volta a pedir confirmação à cozinha." /><OrderForm {...options} orderId={id} initial={result.order.revision} /></>; }
