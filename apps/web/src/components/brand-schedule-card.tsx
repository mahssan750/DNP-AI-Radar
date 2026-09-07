import { IconInfoCircle, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useState } from "react";
import { useDefaultDelayHours } from "@/hooks/use-default-delay-hours";
import {
	clampFrequencyDays,
	daysToHours,
	describeFrequency,
	FREQUENCY_DAY_PRESETS,
	hoursToWholeDays,
	MAX_FREQUENCY_DAYS,
	MIN_FREQUENCY_DAYS,
} from "@/lib/run-frequency";
import { useWriteErrorMessage } from "@/lib/write-errors";
import { setBrandEnabledFn, updateBrandScheduleFn } from "@/server/admin";

const DEFAULT_OPTION = "default";
const CUSTOM_OPTION = "custom";

interface ScheduleBrand {
	id: string;
	name: string;
	enabled: boolean;
	delayOverrideHours: number | null;
}

/** Which dropdown entry represents the brand's stored value. */
function optionForBrand(delayOverrideHours: number | null): string {
	if (delayOverrideHours === null) return DEFAULT_OPTION;
	const days = hoursToWholeDays(delayOverrideHours);
	if (days !== null && FREQUENCY_DAY_PRESETS.includes(days as (typeof FREQUENCY_DAY_PRESETS)[number])) {
		return String(days);
	}
	return CUSTOM_OPTION;
}

function labelForDays(days: number): string {
	return days === 1 ? "Every day" : `Every ${days} days`;
}

/**
 * Run frequency and pause/resume for one brand. Both write columns the worker
 * already reads, so nothing here changes how scheduling works — it only makes
 * the two existing switches reachable.
 */
export function BrandScheduleCard({
	brand,
	onChanged,
}: {
	brand: ScheduleBrand;
	onChanged: () => Promise<void> | void;
}) {
	const defaultDelayHours = useDefaultDelayHours();
	const writeError = useWriteErrorMessage();

	const storedOption = optionForBrand(brand.delayOverrideHours);
	const [option, setOption] = useState<string>(storedOption);
	const [customDays, setCustomDays] = useState<string>(() => {
		const days = brand.delayOverrideHours === null ? null : hoursToWholeDays(brand.delayOverrideHours);
		return String(days ?? 7);
	});
	const [saving, setSaving] = useState(false);
	const [pausing, setPausing] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	// Reseed when the brand is refetched, without discarding an edit in progress.
	const seed = `${brand.id}:${brand.delayOverrideHours}`;
	const [seededFrom, setSeededFrom] = useState<string>(seed);
	if (seed !== seededFrom) {
		setSeededFrom(seed);
		setOption(storedOption);
	}

	const effectiveHours = brand.delayOverrideHours ?? defaultDelayHours;

	const selectedHours = (): number | null => {
		if (option === DEFAULT_OPTION) return null;
		if (option === CUSTOM_OPTION) return daysToHours(clampFrequencyDays(Number(customDays)));
		return daysToHours(Number(option));
	};

	const handleSave = async () => {
		setSaving(true);
		setError("");
		setSuccess("");
		try {
			await updateBrandScheduleFn({ data: { brandId: brand.id, delayOverrideHours: selectedHours() } });
			await onChanged();
			setSuccess("Run frequency saved.");
		} catch (err) {
			setError(writeError(err, "Failed to save the run frequency."));
		} finally {
			setSaving(false);
		}
	};

	const setEnabled = async (enabled: boolean) => {
		setPausing(true);
		setError("");
		setSuccess("");
		try {
			await setBrandEnabledFn({ data: { brandId: brand.id, enabled } });
			await onChanged();
			setSuccess(enabled ? "Tracking resumed." : "Tracking paused.");
		} catch (err) {
			setError(writeError(err, enabled ? "Failed to resume tracking." : "Failed to pause tracking."));
		} finally {
			setPausing(false);
		}
	};

	const items: Record<string, string> = {
		[DEFAULT_OPTION]: `Default (${describeFrequency(defaultDelayHours)})`,
		...Object.fromEntries(FREQUENCY_DAY_PRESETS.map((days) => [String(days), labelForDays(days)])),
		[CUSTOM_OPTION]: "Custom…",
	};

	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5 text-base">
					Schedule
					<Tooltip>
						<TooltipTrigger render={<IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />} />
						<TooltipContent className="max-w-xs text-xs font-normal">
							How often this brand&apos;s prompts are sent to the AI engines, and whether they are sent at all. Only
							administrators can change these.
						</TooltipContent>
					</Tooltip>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="space-y-2">
					<Label htmlFor="run-frequency">Run frequency</Label>
					<div className="flex flex-wrap items-center gap-2">
						<Select items={items} value={option} onValueChange={(value) => setOption(value ?? DEFAULT_OPTION)}>
							<SelectTrigger id="run-frequency" className="w-56">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(items).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{option === CUSTOM_OPTION && (
							<div className="flex items-center gap-2">
								<Input
									id="run-frequency-days"
									type="number"
									min={MIN_FREQUENCY_DAYS}
									max={MAX_FREQUENCY_DAYS}
									className="w-24"
									value={customDays}
									onChange={(e) => setCustomDays(e.target.value)}
									disabled={saving}
									aria-label="Days between runs"
								/>
								<span className="text-sm text-muted-foreground">days</span>
							</div>
						)}
						<Button onClick={handleSave} disabled={saving || pausing} className="cursor-pointer">
							{saving ? "Saving..." : "Save frequency"}
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						Currently running {describeFrequency(effectiveHours)}. Changing this affects future runs only &mdash;
						results already collected are kept.
					</p>
				</div>

				<div className="space-y-2 border-t pt-4">
					<Label>Data collection</Label>
					<div className="flex flex-wrap items-center gap-3">
						{brand.enabled ? (
							<Dialog>
								<DialogTrigger
									render={<Button variant="outline" disabled={saving || pausing} className="cursor-pointer" />}
								>
									<IconPlayerPause className="h-4 w-4 mr-1.5" />
									Pause tracking
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Pause tracking for {brand.name}?</DialogTitle>
										<DialogDescription>
											No new questions will be sent to the AI engines, and no new results or costs will be produced.
											Everything already collected stays exactly as it is, and you can resume at any time.
										</DialogDescription>
									</DialogHeader>
									<DialogFooter>
										<DialogClose render={<Button variant="outline" className="cursor-pointer" />}>Cancel</DialogClose>
										<DialogClose
											render={
												<Button
													variant="destructive"
													className="cursor-pointer"
													onClick={() => {
														void setEnabled(false);
													}}
												/>
											}
										>
											Pause tracking
										</DialogClose>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						) : (
							<Button
								onClick={() => {
									void setEnabled(true);
								}}
								disabled={saving || pausing}
								className="cursor-pointer"
							>
								<IconPlayerPlay className="h-4 w-4 mr-1.5" />
								{pausing ? "Resuming..." : "Resume tracking"}
							</Button>
						)}
						<span className="text-sm text-muted-foreground">
							{brand.enabled ? "Tracking is active." : "Tracking is paused — no new results are being collected."}
						</span>
					</div>
				</div>

				{error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
				{success && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{success}</div>}
			</CardContent>
		</Card>
	);
}
