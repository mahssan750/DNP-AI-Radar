/**
 * The schedule is stored as hours between cycles, but people think about it in
 * days ("every 3 days"), so the settings card talks in days and converts here.
 */

export const HOURS_PER_DAY = 24;

/** Day presets offered in the dropdown, in the order they appear. */
export const FREQUENCY_DAY_PRESETS = [1, 2, 3, 5, 7, 14, 30] as const;

export const MIN_FREQUENCY_DAYS = 1;
export const MAX_FREQUENCY_DAYS = 365;

export function daysToHours(days: number): number {
	return Math.round(days) * HOURS_PER_DAY;
}

/** Whole days only — a stored value like 12 hours has no day equivalent. */
export function hoursToWholeDays(hours: number): number | null {
	return hours > 0 && hours % HOURS_PER_DAY === 0 ? hours / HOURS_PER_DAY : null;
}

/** Plain-language description of a cadence, e.g. "every 3 days", "every 12 hours". */
export function describeFrequency(hours: number): string {
	const days = hoursToWholeDays(hours);
	if (days === 1) return "every day";
	if (days !== null) return `every ${days} days`;
	if (hours === 1) return "every hour";
	return `every ${hours} hours`;
}

export function clampFrequencyDays(days: number): number {
	if (!Number.isFinite(days)) return MIN_FREQUENCY_DAYS;
	return Math.min(MAX_FREQUENCY_DAYS, Math.max(MIN_FREQUENCY_DAYS, Math.round(days)));
}
