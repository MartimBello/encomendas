import type { OrderStatus } from "@/lib/domain";
import { statusLabels } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status, revised = false }: { status: OrderStatus; revised?: boolean }) {
  return <span className="inline-flex flex-wrap gap-1"><Badge variant={status}>{statusLabels[status]}</Badge>{revised && <Badge variant="info">Revisão</Badge>}</span>;
}
