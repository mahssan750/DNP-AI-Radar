import { describe, expect, it } from "vitest";
import { averageGapDays, clampWindowDays, describeWindow } from "@/lib/statistics-window";

describe("clampWindowDays", () => {
	it("keeps the slider inside one day to one year", () => {
		expect(clampWindowDays(0)).toBe(1);
		expect(clampWindowDays(1000)).toBe(365);
		expect(clampWindowDays(45)).toBe(45);
	});

	it("falls back to the default for a value that is not a number", () => {
		expect(clampWindowDays(Number.NaN)).toBe(30);
	});
});

describe("describeWindow", () => {
	it("names the common spans", () => {
		expect(describeWindow(1)).toBe("Today");
		expect(describeWindow(7)).toBe("Last 7 days");
		expect(describeWindow(30)).toBe("Last 30 days");
		expect(describeWindow(90)).toBe("Last 3 months");
		expect(describeWindow(365)).toBe("Last 12 months");
	});

	it("falls back to a day count for an arbitrary span", () => {
		expect(describeWindow(45)).toBe("Last 45 days");
	});
});

describe("averageGapDays", () => {
	it("reads back a three-day cadence from the days that produced runs", () => {
		expect(averageGapDays(["2026-09-01", "2026-09-04", "2026-09-07"])).toBe(3);
	});

	it("reports one day when every day is active", () => {
		expect(averageGapDays(["2026-09-01", "2026-09-02", "2026-09-03"])).toBe(1);
	});

	it("ignores the order the dates arrive in", () => {
		expect(averageGapDays(["2026-09-07", "2026-09-01"])).toBe(6);
	});

	it("has no gap to report for fewer than two active days", () => {
		expect(averageGapDays([])).toBeNull();
		expect(averageGapDays(["2026-09-01"])).toBeNull();
	});
});
