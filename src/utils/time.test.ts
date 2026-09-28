import {
  addDays,
  fromLocalInputValue,
  localDateISO,
  localDateOf,
  startOfWeek,
  toLocalInputValue,
  weekdayIndex,
} from "./time";

describe("Cambodia-time helpers", () => {
  it("uses Phnom Penh's date, not UTC's, across UTC midnight", () => {
    // 20:00 UTC on 1 Jan is 03:00 on 2 Jan in Phnom Penh (UTC+7).
    expect(localDateISO(new Date("2030-01-01T20:00:00Z"))).toBe("2030-01-02");
    expect(localDateOf("2030-01-01T16:59:00Z")).toBe("2030-01-01");
  });

  it("round-trips datetime-local input values as Cambodia time", () => {
    expect(fromLocalInputValue("2030-01-02T07:30")).toBe("2030-01-02T07:30:00+07:00");
    expect(toLocalInputValue("2030-01-02T00:30:00Z")).toBe("2030-01-02T07:30");
  });

  it("does calendar math with Monday-first weeks", () => {
    expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(weekdayIndex("2030-01-07")).toBe(0); // Monday
    expect(weekdayIndex("2030-01-13")).toBe(6); // Sunday
    expect(startOfWeek("2030-01-10")).toBe("2030-01-07");
  });
});
