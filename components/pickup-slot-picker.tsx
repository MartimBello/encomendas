"use client";

import { useId, useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { pickupSlotParts, type PickupSlot } from "@/lib/dates";
import { cn } from "@/lib/utils";

type PickupSlotPickerProps = {
  slots: PickupSlot[];
  date: string;
  time: string;
  value: string;
  disabled?: boolean;
  onChange: (selection: { date: string; time: string; value: string }) => void;
};

export function PickupSlotPicker({ slots, date, time, value, disabled = false, onChange }: PickupSlotPickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const timeOptionsId = useId();
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
        <Label htmlFor="pickup-date">Data de levantamento<span className="ml-1 text-destructive">*</span></Label>
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
        <Label htmlFor="pickup-time">Hora de levantamento<span className="ml-1 text-destructive">*</span></Label>
        <div className="relative">
          <Clock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="pickup-time"
            type="time"
            value={time}
            list={timeOptionsId}
            min={availableTimes.at(0)?.time}
            max={availableTimes.at(-1)?.time}
            step={60}
            disabled={disabled || !date}
            aria-invalid={Boolean(time && !value)}
            aria-describedby="pickup-time-help"
            className="pl-10"
            onChange={(event) => selectTime(event.target.value)}
          />
          <datalist id={timeOptionsId}>
            {availableTimes.map((slot) => <option key={slot.value} value={slot.time} />)}
          </datalist>
        </div>
        <p id="pickup-time-help" className={cn("text-xs text-muted-foreground", time && !value && "font-medium text-destructive")}>
          {!date ? "Escolha primeiro a data." : availableTimes.length === 0 ? "Não existem horários disponíveis nesta data." : time && !value ? "Escolha um dos horários disponíveis." : `Disponíveis: ${availableTimes.map((slot) => slot.time).join(", ")}`}
        </p>
      </div>
    </div>
  );
}
