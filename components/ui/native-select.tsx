import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return <div className="relative w-full">
    <select
      data-slot="native-select"
      className={cn("h-12 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-9 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  </div>;
}

export function NativeSelectOption(props: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

export function NativeSelectOptGroup(props: React.ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" {...props} />;
}
