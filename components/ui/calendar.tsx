"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & { buttonVariant?: React.ComponentProps<typeof Button>["variant"] }) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("group/calendar bg-background p-3 [--cell-size:2.75rem]", className)}
      captionLayout={captionLayout}
      formatters={{ formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }), ...formatters }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaultClassNames.nav),
        button_previous: cn(buttonVariants({ variant: buttonVariant }), "size-[var(--cell-size)] min-h-0 p-0", defaultClassNames.button_previous),
        button_next: cn(buttonVariants({ variant: buttonVariant }), "size-[var(--cell-size)] min-h-0 p-0", defaultClassNames.button_next),
        month_caption: cn("flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]", defaultClassNames.month_caption),
        dropdowns: cn("flex h-[var(--cell-size)] w-full items-center justify-center gap-1.5 text-sm font-medium", defaultClassNames.dropdowns),
        dropdown_root: cn("relative rounded-lg border border-input shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20", defaultClassNames.dropdown_root),
        dropdown: cn("absolute inset-0 bg-popover opacity-0", defaultClassNames.dropdown),
        caption_label: cn("select-none font-medium", captionLayout === "label" ? "text-sm" : "flex h-8 items-center gap-1 rounded-md px-2 text-sm [&>svg]:size-3.5", defaultClassNames.caption_label),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn("flex-1 rounded-md text-xs font-normal text-muted-foreground select-none", defaultClassNames.weekday),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-[var(--cell-size)] select-none", defaultClassNames.week_number_header),
        week_number: cn("text-xs text-muted-foreground select-none", defaultClassNames.week_number),
        day: cn("group/day relative aspect-square h-full w-full p-0 text-center select-none", defaultClassNames.day),
        range_start: cn("rounded-l-md bg-accent", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn("rounded-md bg-accent text-accent-foreground", defaultClassNames.today),
        outside: cn("text-muted-foreground", defaultClassNames.outside),
        disabled: cn("text-muted-foreground opacity-35", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => <div data-slot="calendar" ref={rootRef} className={cn(rootClassName)} {...rootProps} />,
        Chevron: ({ className: iconClassName, orientation, ...iconProps }) => orientation === "left" ? <ChevronLeft className={cn("size-4", iconClassName)} {...iconProps} /> : orientation === "right" ? <ChevronRight className={cn("size-4", iconClassName)} {...iconProps} /> : <ChevronDown className={cn("size-4", iconClassName)} {...iconProps} />,
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...weekProps }) => <td {...weekProps}><div className="flex size-[var(--cell-size)] items-center justify-center text-center">{children}</div></td>,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString("sv-SE")}
      data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle}
      className={cn(
        "flex aspect-square size-auto w-full min-w-[var(--cell-size)] flex-col gap-1 rounded-lg p-0 font-normal leading-none data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
