import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn("flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
}
