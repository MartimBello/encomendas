"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" /><DialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border bg-background p-6 shadow-2xl", className)} {...props}>{children}<DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Fechar"><X className="size-5" /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>;
}
export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("space-y-1.5 pr-8", className)} {...props} />; }
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) { return <DialogPrimitive.Title className={cn("text-xl font-semibold", className)} {...props} />; }
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) { return <DialogPrimitive.Description className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />; }
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />; }
