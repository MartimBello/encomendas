"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger className={cn("flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-left text-base outline-none focus:ring-3 focus:ring-primary/15 disabled:opacity-50", className)} {...props}>{children}<SelectPrimitive.Icon><ChevronDown className="size-4 opacity-60" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
}

export function SelectContent({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content position="popper" sideOffset={6} className={cn("z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl", className)} {...props}><SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal>;
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item className={cn("relative flex min-h-11 cursor-default select-none items-center rounded-lg py-2 pl-9 pr-3 text-sm outline-none focus:bg-muted data-[disabled]:opacity-50", className)} {...props}><span className="absolute left-3"><SelectPrimitive.ItemIndicator><Check className="size-4" /></SelectPrimitive.ItemIndicator></span><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>;
}
