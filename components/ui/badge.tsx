import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "border-border text-foreground",
      pending: "border-amber-200 bg-amber-100 text-amber-900",
      accepted: "border-emerald-200 bg-emerald-100 text-emerald-900",
      rejected: "border-red-200 bg-red-100 text-red-900",
      cancelled: "border-slate-200 bg-slate-100 text-slate-700",
      info: "border-violet-200 bg-violet-100 text-violet-900",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
