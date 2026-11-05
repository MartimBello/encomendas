"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return <CheckboxPrimitive.Root data-slot="checkbox" className={cn("peer grid size-5 shrink-0 place-items-center rounded-md border border-input bg-background outline-none transition focus-visible:ring-3 focus-visible:ring-primary/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:opacity-50", className)} {...props}><CheckboxPrimitive.Indicator><Check className="size-3.5" /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;
}
