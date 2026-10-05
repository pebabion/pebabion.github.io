import { describe as group, expect, it } from "vitest";
import {
  DEFAULT_SEC_PER_KM,
  KM_PER_MI,
  type Unit,
  clock,
  describe,
  fromUnit,
  outputs,
  parsePace,
  parseSpeed,
  snap,
  toUnit,
} from "./running";

const UNITS: Unit[] = ["mi", "km", "mph", "kmh"];

group("clock", () => {
  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [60, "1:00"],
    [540, "9:00"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [14027, "3:53:47"],
  ])("%d s → %s", (sec, text) => {
    expect(clock(sec)).toBe(text);
  });

  it("rounds to the nearest second, carrying into minutes and hours", () => {
    expect(clock(59.6)).toBe("1:00");
    expect(clock(3599.5)).toBe("1:00:00");
    expect(clock(59.4)).toBe("0:59");
  });
});

group("unit conversion", () => {
  it("knows a mile is 1.609344 km", () => {
    expect(toUnit(fromUnit(600, "mi"), "km")).toBeCloseTo(600 / KM_PER_MI, 9);
  });

  it.each(UNITS)("%s survives a round trip", (u) => {
    for (const v of [4, 7.5, 12, 300, 540]) {
      expect(toUnit(fromUnit(v, u), u)).toBeCloseTo(v, 9);
    }
  });

  it("agrees between pace and speed", () => {
    // 6:00 /km is exactly 10 km/h; 10:00 /mi is exactly 6 mph.
    expect(toUnit(fromUnit(360, "km"), "kmh")).toBeCloseTo(10, 9);
    expect(toUnit(fromUnit(600, "mi"), "mph")).toBeCloseTo(6, 9);
  });
});

group("outputs", () => {
  it("matches known values for 9:00 /mi", () => {
    expect(outputs(fromUnit(540, "mi"))).toEqual({
      mi: "9:00",
      km: "5:36",
      mph: "6.67",
      kmh: "10.73",
      lap: "2:14",
      "5k": "27:58",
      "10k": "55:55",
      half: "1:57:59",
      full: "3:55:58",
    });
  });

  it("matches known values for 5:00 /km", () => {
    const o = outputs(300);
    expect(o.kmh).toBe("12.00");
    expect(o.lap).toBe("2:00");
    expect(o["5k"]).toBe("25:00");
    expect(o["10k"]).toBe("50:00");
    expect(o.half).toBe("1:45:29");
    expect(o.full).toBe("3:30:59");
  });

  it("starts at 9:00 /mi by default", () => {
    expect(outputs(DEFAULT_SEC_PER_KM).mi).toBe("9:00");
  });
});

group("describe", () => {
  it("shows the value in its own unit, without trailing zeros on speeds", () => {
    expect(describe(fromUnit(510, "mi"), "mi")).toBe("8:30 /mi");
    expect(describe(300, "km")).toBe("5:00 /km");
    expect(describe(fromUnit(12, "kmh"), "kmh")).toBe("12 km/h");
    expect(describe(fromUnit(7.5, "mph"), "mph")).toBe("7.5 mph");
  });
});

group("parsePace", () => {
  it("reads minutes and seconds", () => {
    expect(parsePace("9", "15", "mi")).toBeCloseTo(fromUnit(555, "mi"), 9);
    expect(parsePace("5", "", "km")).toBe(300);
    expect(parsePace("", "45", "km")).toBe(45);
  });

  it.each([
    ["", ""],
    ["0", "0"],
    ["9", "60"],
    ["9", "75"],
    ["abc", "10"],
    ["-1", "30"],
    ["9", "-5"],
  ])("rejects %j : %j", (m, s) => {
    expect(parsePace(m, s, "mi")).toBeNull();
  });
});

group("parseSpeed", () => {
  it("reads dot and comma decimals", () => {
    expect(parseSpeed("12", "kmh")).toBe(300);
    expect(parseSpeed("7.5", "mph")).toBeCloseTo(fromUnit(7.5, "mph"), 9);
    expect(parseSpeed("7,5", "mph")).toBeCloseTo(fromUnit(7.5, "mph"), 9);
  });

  it.each(["", " ", "0", "-3", "fast", "1.2.3"])("rejects %j", (text) => {
    expect(parseSpeed(text, "kmh")).toBeNull();
  });
});

group("snap", () => {
  it("rounds paces to 5 s and speeds to 0.1", () => {
    expect(snap(557, "mi")).toBe(555); // 9:17 → 9:15
    expect(snap(562, "mi")).toBe(560); // 9:22 → 9:20
    expect(snap(10.83, "kmh")).toBeCloseTo(10.8, 9);
    expect(snap(10.86, "kmh")).toBeCloseTo(10.9, 9);
  });

  it("never goes to zero or below", () => {
    expect(snap(0, "mi")).toBe(5);
    expect(snap(-30, "km")).toBe(5);
    expect(snap(0.02, "mph")).toBeCloseTo(0.1, 9);
  });
});
