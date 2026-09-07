import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { Button } from "@workspace/ui/components/button";
import { useState } from "react";
import { useBrand } from "@/hooks/use-brands";
import { useViewer } from "@/hooks/use-route-context";
import { useWriteErrorMessage } from "@/lib/write-errors";
import { setBrandEnabledFn } from "@/server/admin";

/**
 * Shown on every page of a paused brand. Without it the dashboard looks merely
 * quiet, and a pause left on by accident is indistinguishable from a stalled
 * worker.
 */
export function TrackingPausedBanner() {
	const { data: brand, refetch } = useBrand();
	const { isAdmin } = useViewer();
	const writeError = useWriteErrorMessage();
	const [resuming, setResuming] = useState(false);
	const [error, setError] = useState("");

	if (!brand || brand.enabled) return null;

	const resume = async () => {
		setResuming(true);
		setError("");
		try {
			await setBrandEnabledFn({ data: { brandId: brand.id, enabled: true } });
			await refetch();
		} catch (err) {
			setError(writeError(err, "Failed to resume tracking."));
		} finally {
			setResuming(false);
		}
	};

	return (
		<div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 print:hidden">
			<div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 text-sm">
				<IconPlayerPause className="h-4 w-4 flex-shrink-0" />
				<span>
					<strong>Data collection is paused</strong> for {brand.name}. No new AI results are being gathered.
				</span>
				{isAdmin && (
					<Button
						size="sm"
						variant="outline"
						className="cursor-pointer ml-auto"
						disabled={resuming}
						onClick={() => {
							void resume();
						}}
					>
						<IconPlayerPlay className="h-4 w-4 mr-1.5" />
						{resuming ? "Resuming..." : "Resume"}
					</Button>
				)}
				{error && <span className="text-destructive">{error}</span>}
			</div>
		</div>
	);
}
