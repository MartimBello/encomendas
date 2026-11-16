"use client";

import { useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarDays, Clock } from "lucide-react";
import type { FulfillmentType } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pickupSlotParts, type PickupSlot } from "@/lib/dates";
import { cn } from "@/lib/utils";

type PickupSlotPickerProps = {
  slots: PickupSlot[];
  date: string;
  time: string;
  value: string;
  fulfillmentType?: FulfillmentType;
  disabled?: boolean;
  onChange: (selection: { date: string; time: string; value: string }) => void;
};

export function PickupSlotPicker({ slots, date, time, value, fulfillmentType = "pickup", disabled = false, onChange }: PickupSlotPickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, { time: string; value: string }[]>();
    for (const slot of slots) {
      const parts = pickupSlotParts(slot.value);
      grouped.set(parts.date, [...(grouped.get(parts.date) || []), { time: parts.time, value: slot.value }]);
    }
    return grouped;
  }, [slots]);
  const availableDates = useMemo(() => new Set(slotsByDate.keys()), [slotsByDate]);
  const availableTimes = slotsByDate.get(date) || [];
  const selectedDate = date ? parse(date, "yyyy-MM-dd", new Date()) : undefined;
  const firstAvailableDate = slots.length ? parse(pickupSlotParts(slots[0].value).date, "yyyy-MM-dd", new Date()) : undefined;
  const receivingLabel = fulfillmentType === "delivery" ? "entrega" : "levantamento";

  function selectDate(next: Date | undefined) {
    if (!next) return;
    const nextDate = format(next, "yyyy-MM-dd");
    const matchingSlot = slotsByDate.get(nextDate)?.find((slot) => slot.time === time);
    onChange({ date: nextDate, time: matchingSlot ? time : "", value: matchingSlot?.value || "" });
    setCalendarOpen(false);
  }

  function selectTime(nextTime: string) {
    const matchingSlot = availableTimes.find((slot) => slot.time === nextTime);
    onChange({ date, time: nextTime, value: matchingSlot?.value || "" });
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="pickup-date">Data de {receivingLabel}<span className="ml-1 text-destructive">*</span></Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              id="pickup-date"
              type="button"
              variant="outline"
              disabled={disabled || slots.length === 0}
              data-empty={!selectedDate}
              className="h-12 w-full justify-start text-left text-base font-normal data-[empty=true]:text-muted-foreground"
            >
              <CalendarDays />
              {selectedDate ? format(selectedDate, "PPP", { locale: pt }) : disabled ? "Escolha primeiro a loja" : "Escolher data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0">
            <Calendar
              mode="single"
              locale={pt}
              selected={selectedDate}
              defaultMonth={selectedDate || firstAvailableDate}
              onSelect={selectDate}
              disabled={(day) => !availableDates.has(format(day, "yyyy-MM-dd"))}
              timeZone="Europe/Lisbon"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pickup-time">Hora de {receivingLabel}<span className="ml-1 text-destructive">*</span></Label>
        <Select value={value ? time : ""} onValueChange={selectTime} disabled={disabled || !date || availableTimes.length === 0}>
          <SelectTrigger id="pickup-time" aria-describedby="pickup-time-help"><span className="flex items-center gap-2"><Clock /><SelectValue placeholder="Escolher hora" /></span></SelectTrigger>
          <SelectContent><SelectGroup>{availableTimes.map((slot) => <SelectItem key={slot.value} value={slot.time}>{slot.time}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
        <p id="pickup-time-help" className={cn("text-xs text-muted-foreground", time && !value && "font-medium text-destructive")}>
          {!date ? "Escolha primeiro a data." : availableTimes.length === 0 ? "Não existem horários disponíveis nesta data." : time && !value ? "Escolha um dos horários disponíveis." : `Disponíveis: ${availableTimes.map((slot) => slot.time).join(", ")}`}
        </p>
      </div>
    </div>
  );
}
