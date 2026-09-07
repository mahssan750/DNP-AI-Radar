/** Bounds and presets for the statistics time slider, shared by the route, the hook and the server function. */

export const MIN_WINDOW_DAYS = 1;
export const MAX_WINDOW_DAYS = 365;
export const DEFAULT_WINDOW_DAYS = 30;

/** Quick jumps beside the slider, in days. */
export const WINDOW_PRESETS = [7, 30, 90, 180, 365] as const;

export function clampWindowDays(days: number): number {
	if (!Number.isFinite(days)) return DEFAULT_WINDOW_DAYS;
	return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, Math.round(days)));
}

export function describeWindow(days: number): string {
	if (days === 1) return "Today";
	if (days === 7) return "Last 7 days";
	if (days === 365) return "Last 12 months";
	if (days % 30 === 0) {
		const months = days / 30;
		return months === 1 ? "Last 30 days" : `Last ${months} months`;
	}
	return `Last ${days} days`;
}

/**
 * Typical spacing between the days that actually produced runs. With one cycle
 * every three days the active days fall three apart, so this is the readback
 * for the run-frequency setting.
 */
export function averageGapDays(dates: string[]): number | null {
	if (dates.length < 2) return null;
	const sorted = [...dates].sort();
	const first = Date.parse(`${sorted[0]}T00:00:00Z`);
	const last = Date.parse(`${sorted[sorted.length - 1]}T00:00:00Z`);
	if (Number.isNaN(first) || Number.isNaN(last)) return null;
	const spanDays = (last - first) / 86_400_000;
	return Math.round((spanDays / (sorted.length - 1)) * 10) / 10;
}
