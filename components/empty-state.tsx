import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description: string; action?: React.ReactNode; icon?: LucideIcon }) {
  return <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center"><span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Icon /></span><h2 className="font-semibold">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>{action && <div className="mt-5 flex justify-center">{action}</div>}</div>;
}
