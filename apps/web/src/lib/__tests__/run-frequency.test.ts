import { describe, expect, it } from "vitest";
import { clampFrequencyDays, daysToHours, describeFrequency, hoursToWholeDays } from "@/lib/run-frequency";

describe("daysToHours", () => {
	it("converts the day presets the settings card offers", () => {
		expect(daysToHours(1)).toBe(24);
		expect(daysToHours(3)).toBe(72);
		expect(daysToHours(7)).toBe(168);
	});
});

describe("hoursToWholeDays", () => {
	it("returns the day count for whole days", () => {
		expect(hoursToWholeDays(72)).toBe(3);
	});

	it("returns null for a cadence that is not a whole number of days", () => {
		expect(hoursToWholeDays(12)).toBeNull();
		expect(hoursToWholeDays(0)).toBeNull();
	});
});

describe("describeFrequency", () => {
	it("describes day cadences in days", () => {
		expect(describeFrequency(24)).toBe("every day");
		expect(describeFrequency(72)).toBe("every 3 days");
	});

	it("falls back to hours when the cadence is shorter than a day", () => {
		expect(describeFrequency(1)).toBe("every hour");
		expect(describeFrequency(12)).toBe("every 12 hours");
	});
});

describe("clampFrequencyDays", () => {
	it("keeps the value inside one day to one year", () => {
		expect(clampFrequencyDays(0)).toBe(1);
		expect(clampFrequencyDays(400)).toBe(365);
		expect(clampFrequencyDays(30)).toBe(30);
	});

	it("falls back to the minimum for a value that is not a number", () => {
		expect(clampFrequencyDays(Number.NaN)).toBe(1);
	});
});
