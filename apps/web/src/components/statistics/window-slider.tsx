import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
	clampWindowDays,
	describeWindow,
	MAX_WINDOW_DAYS,
	MIN_WINDOW_DAYS,
	WINDOW_PRESETS,
} from "@/lib/statistics-window";

/**
 * Time window control for the statistics page: a range slider for any span
 * between one day and a year, with the common spans as one-click presets.
 *
 * A native range input rather than a design-system slider — the project has no
 * slider component, and a plain input is keyboard- and screen-reader-accessible
 * without one.
 */
export function WindowSlider({
	days,
	onChange,
	fromDate,
	toDate,
}: {
	days: number;
	onChange: (days: number) => void;
	fromDate?: string;
	toDate?: string;
}) {
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<Label htmlFor="stats-window">Time period</Label>
				<span className="text-sm text-muted-foreground tabular-nums">
					{describeWindow(days)}
					{fromDate && toDate ? ` — ${fromDate} to ${toDate}` : ""}
				</span>
			</div>
			<input
				id="stats-window"
				type="range"
				min={MIN_WINDOW_DAYS}
				max={MAX_WINDOW_DAYS}
				step={1}
				value={days}
				onChange={(e) => onChange(clampWindowDays(Number(e.target.value)))}
				aria-label="Number of days to include"
				aria-valuetext={`${days} days`}
				className="w-full cursor-pointer accent-blue-600 print:hidden"
			/>
			<div className="flex flex-wrap items-center gap-2 print:hidden">
				{WINDOW_PRESETS.map((preset) => (
					<Button
						key={preset}
						type="button"
						size="sm"
						variant={days === preset ? "default" : "outline"}
						className="cursor-pointer"
						onClick={() => onChange(preset)}
					>
						{describeWindow(preset)}
					</Button>
				))}
				<span className="text-xs text-muted-foreground">
					{days} day{days === 1 ? "" : "s"}
				</span>
			</div>
		</div>
	);
}
