import { addDays, addMinutes, isBefore } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { PickupWindow } from "@/lib/domain";

export const APP_TIME_ZONE = "Europe/Lisbon";

export type PickupSlot = { value: string; label: string; locationId: string };

export function formatDateTime(value: string | Date) {
  return formatInTimeZone(value, APP_TIME_ZONE, "dd/MM/yyyy 'às' HH:mm");
}

export function formatDate(value: string | Date) {
  return formatInTimeZone(value, APP_TIME_ZONE, "dd/MM/yyyy");
}

export function inputLocalToUtc(value: string) {
  return fromZonedTime(value, APP_TIME_ZONE).toISOString();
}

export function pickupSlotParts(value: string | Date) {
  return {
    date: formatInTimeZone(value, APP_TIME_ZONE, "yyyy-MM-dd"),
    time: formatInTimeZone(value, APP_TIME_ZONE, "HH:mm"),
  };
}

export function buildPickupSlots(
  windows: PickupWindow[],
  minimumLeadMinutes: number,
  horizonDays: number,
  now = new Date(),
) {
  const earliest = addMinutes(now, minimumLeadMinutes);
  const slots: PickupSlot[] = [];

  const localMidnight = fromZonedTime(`${formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd")}T00:00:00`, APP_TIME_ZONE);
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const day = addDays(localMidnight, offset);
    const weekday = Number(formatInTimeZone(day, APP_TIME_ZONE, "i")) % 7;
    for (const window of windows.filter((entry) => entry.active && entry.weekday === weekday)) {
      const datePart = formatInTimeZone(day, APP_TIME_ZONE, "yyyy-MM-dd");
      const [openHour, openMinute] = window.opens_at.split(":").map(Number);
      const [closeHour, closeMinute] = window.closes_at.split(":").map(Number);
      let minutes = openHour * 60 + openMinute;
      const close = closeHour * 60 + closeMinute;
      while (minutes < close) {
        const local = `${datePart}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
        const utc = fromZonedTime(local, APP_TIME_ZONE);
        if (!isBefore(utc, earliest)) {
          slots.push({
            value: utc.toISOString(),
            label: formatInTimeZone(utc, APP_TIME_ZONE, "EEE, dd/MM · HH:mm"),
            locationId: window.location_id,
          });
        }
        minutes += window.slot_minutes;
      }
    }
  }
  return slots;
}

export function isExpired(createdAt: Date, retentionMonths: number, now = new Date()) {
  const expiry = new Date(createdAt);
  expiry.setMonth(expiry.getMonth() + retentionMonths);
  return expiry <= now;
}
