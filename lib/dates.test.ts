import { describe, expect, it } from "vitest";
import { buildPickupSlots, formatDateTime, isExpired, pickupSlotParts } from "@/lib/dates";
import type { PickupWindow } from "@/lib/domain";

describe("pickup slot generation", () => {
  it("uses Europe/Lisbon across the spring daylight-saving transition", () => {
    const windows: PickupWindow[] = [{ id: "1", location_id: "store", weekday: 0, opens_at: "10:00:00", closes_at: "11:30:00", slot_minutes: 30, active: true }];
    const slots = buildPickupSlots(windows, 0, 2, new Date("2026-03-28T12:00:00Z"));
    expect(slots).toHaveLength(3);
    expect(slots[0].value).toBe("2026-03-29T09:00:00.000Z");
    expect(slots[0].label).toContain("10:00");
  });

  it("applies lead time and location filters in the generated records", () => {
    const windows: PickupWindow[] = [{ id: "1", location_id: "porto", weekday: 5, opens_at: "10:00:00", closes_at: "12:00:00", slot_minutes: 30, active: true }];
    const slots = buildPickupSlots(windows, 90, 0, new Date("2026-10-09T09:00:00Z"));
    expect(slots.every((slot) => slot.locationId === "porto")).toBe(true);
    expect(slots[0].label).toContain("11:30");
  });
});

describe("date helpers", () => {
  it("formats in Portuguese local time", () => expect(formatDateTime("2026-10-09T09:30:00Z")).toContain("10:30"));
  it("separates pickup dates and times in Europe/Lisbon", () => expect(pickupSlotParts("2026-10-09T23:30:00Z")).toEqual({ date: "2026-10-10", time: "00:30" }));
  it("calculates retention expiry", () => expect(isExpired(new Date("2024-01-01T00:00:00Z"), 24, new Date("2026-01-02T00:00:00Z"))).toBe(true));
});
