import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("flex min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:opacity-50", className)} {...props} />;
}
