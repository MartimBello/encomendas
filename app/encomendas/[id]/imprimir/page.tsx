import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getOrder } from "@/lib/data";
import { PrintOrder } from "@/components/print-order";

export default async function PrintPage({ params, searchParams }: PageProps<"/encomendas/[id]/imprimir">) {
  await requireProfile(["admin", "store", "kitchen"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await getOrder(id);
  if (!result?.order.revision) notFound();

  const requestedVersion = typeof query.versao === "string" ? Number(query.versao) : null;
  const revision = requestedVersion ? result.revisions.find((entry) => entry.version === requestedVersion) : result.order.revision;
  if (!revision) notFound();
  const isAcceptedSnapshot = result.order.status === "accepted" && revision.id === result.order.accepted_revision_id;
  if (!requestedVersion && !isAcceptedSnapshot) notFound();

  return <PrintOrder
    order={{ ...result.order, revision }}
    obsolete={!isAcceptedSnapshot}
    initialPaper={query.paper === "80mm" ? "80mm" : query.paper === "a4" ? "a4" : undefined}
    printedAt={new Date().toISOString()}
  />;
}
