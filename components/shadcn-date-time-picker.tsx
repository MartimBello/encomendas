"use client";

import { useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = ["00", "15", "30", "45"];

export function ShadcnTimePicker({ name, value = "09:00", label }: { name: string; value?: string; label: string }) {
  const [hour, setHour] = useState(value.slice(0, 2)); const [minute, setMinute] = useState(value.slice(3, 5));
  return <div className="grid grid-cols-[1fr_1fr] gap-2"><input type="hidden" name={name} value={`${hour}:${minute}`} /><Select value={hour} onValueChange={setHour}><SelectTrigger aria-label={`${label}: hora`}><Clock className="size-4 text-muted-foreground" /><SelectValue /></SelectTrigger><SelectContent>{hours.map((entry) => <SelectItem key={entry} value={entry}>{entry} h</SelectItem>)}</SelectContent></Select><Select value={minute} onValueChange={setMinute}><SelectTrigger aria-label={`${label}: minutos`}><SelectValue /></SelectTrigger><SelectContent>{minutes.map((entry) => <SelectItem key={entry} value={entry}>{entry} min</SelectItem>)}</SelectContent></Select></div>;
}

export function ShadcnDateTimePicker({ dateName, timeName, label, defaultTime }: { dateName: string; timeName: string; label: string; defaultTime: string }) {
  const [date, setDate] = useState<Date>();
  return <div className="space-y-2"><input type="hidden" name={dateName} value={date ? format(date, "yyyy-MM-dd") : ""} /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start font-normal" data-empty={!date}><CalendarDays />{date ? format(date, "PPP", { locale: pt }) : `Escolher ${label.toLowerCase()}`}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent></Popover><ShadcnTimePicker name={timeName} value={defaultTime} label={label} /></div>;
}
