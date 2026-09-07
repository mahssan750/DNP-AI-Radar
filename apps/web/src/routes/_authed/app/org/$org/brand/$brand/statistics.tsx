import { IconDownload, IconPrinter } from "@tabler/icons-react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { useMemo } from "react";
import { CsvExportButton } from "@/components/csv-export-button";
import { DailyRunsChart } from "@/components/statistics/daily-runs-chart";
import { WindowSlider } from "@/components/statistics/window-slider";
import { useBrandStatistics } from "@/hooks/use-brand-statistics";
import { useBrand } from "@/hooks/use-brands";
import { useChartDownload } from "@/hooks/use-chart-download";
import { type BrandFilterSearch, useFilterNavigate } from "@/hooks/use-list-filters";
import { pageHead } from "@/lib/route-head";
import { averageGapDays, clampWindowDays, DEFAULT_WINDOW_DAYS, describeWindow } from "@/lib/statistics-window";
import type { BrandStatisticsResponse } from "@/server/statistics";

export const Route = createFileRoute("/_authed/app/org/$org/brand/$brand/statistics")({
	staticData: { crumb: "Statistics" },
	head: pageHead({ description: "Detailed counts of prompt runs, engines, prompts and citations." }),
	component: StatisticsPage,
});

function formatDateTime(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDate(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
	return (
		<Card className="shadow-none py-4">
			<CardContent className="space-y-1">
				<div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
				<div className="text-3xl font-bold tabular-nums">{value}</div>
				{hint && <div className="text-xs text-muted-foreground">{hint}</div>}
			</CardContent>
		</Card>
	);
}

function SectionCard({
	title,
	action,
	children,
}: {
	title: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Card className="shadow-none print-break-inside-avoid">
			<CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-dotted pb-2!">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				{action && <div className="print:hidden">{action}</div>}
			</CardHeader>
			<CardContent className="pt-4">{children}</CardContent>
		</Card>
	);
}

function StatisticsSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-10 w-full" />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{["a", "b", "c", "d"].map((key) => (
					<Skeleton key={key} className="h-24 w-full rounded-lg" />
				))}
			</div>
			<Skeleton className="h-64 w-full rounded-lg" />
			<Skeleton className="h-64 w-full rounded-lg" />
		</div>
	);
}

function StatisticsContent({ stats, brandName }: { stats: BrandStatisticsResponse; brandName: string }) {
	const { chartRef, isDownloading, handleDownload } = useChartDownload(
		`${brandName}-runs-per-day-${stats.fromDate}-to-${stats.toDate}`,
	);

	const gap = useMemo(
		() => averageGapDays(stats.daily.filter((point) => point.runs > 0).map((point) => point.date)),
		[stats.daily],
	);
	const runsPerDay = stats.windowDays > 0 ? Math.round((stats.runs / stats.windowDays) * 10) / 10 : 0;

	return (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label="Prompts run"
					value={stats.runs.toLocaleString()}
					hint={`${stats.lifetimeRuns.toLocaleString()} since tracking began`}
				/>
				<StatCard
					label="Brand mentioned"
					value={`${stats.mentionRate}%`}
					hint={`${stats.mentionedRuns.toLocaleString()} of ${stats.runs.toLocaleString()} answers`}
				/>
				<StatCard
					label="Prompts tracked"
					value={stats.promptsTracked.toLocaleString()}
					hint={`${stats.promptsEnabled.toLocaleString()} switched on`}
				/>
				<StatCard
					label="Citations collected"
					value={stats.totalCitations.toLocaleString()}
					hint={`${stats.uniqueDomains.toLocaleString()} different websites`}
				/>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label="Days with activity"
					value={stats.activeDays.toLocaleString()}
					hint={`of ${stats.windowDays} days`}
				/>
				<StatCard
					label="Typical gap"
					value={gap === null ? "—" : `${gap} day${gap === 1 ? "" : "s"}`}
					hint="Between days that produced runs"
				/>
				<StatCard label="Average per day" value={runsPerDay.toLocaleString()} hint="Prompt runs" />
				<StatCard label="Last run" value={formatDate(stats.lastRun)} hint={formatDateTime(stats.lastRun)} />
			</div>

			<SectionCard
				title="Prompts run per day"
				action={
					<div className="flex gap-2">
						<CsvExportButton
							rows={stats.daily}
							fileNameParts={[brandName, "runs-per-day"]}
							columns={[
								{ header: "Date", value: (row) => row.date },
								{ header: "Prompts run", value: (row) => row.runs },
								{ header: "Mentioned brand", value: (row) => row.mentioned },
							]}
						/>
						<Button
							size="sm"
							variant="secondary"
							className="h-7 cursor-pointer text-xs"
							disabled={isDownloading}
							onClick={() => {
								void handleDownload();
							}}
						>
							<IconDownload className="size-3.5 mr-1" />
							{isDownloading ? "Exporting..." : "PNG"}
						</Button>
					</div>
				}
			>
				<div ref={chartRef}>
					{stats.daily.length === 0 ? (
						<p className="text-sm text-muted-foreground">No runs in this period.</p>
					) : (
						<DailyRunsChart data={stats.daily} />
					)}
				</div>
			</SectionCard>

			<SectionCard
				title="By AI engine"
				action={
					<CsvExportButton
						rows={stats.engines}
						fileNameParts={[brandName, "by-engine"]}
						columns={[
							{ header: "Engine", value: (row) => row.label },
							{ header: "Prompts run", value: (row) => row.runs },
							{ header: "Mentioned brand", value: (row) => row.mentioned },
							{ header: "Mention rate %", value: (row) => row.mentionRate },
						]}
					/>
				}
			>
				{stats.engines.length === 0 ? (
					<p className="text-sm text-muted-foreground">No runs in this period.</p>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Engine</TableHead>
									<TableHead className="text-right">Prompts run</TableHead>
									<TableHead className="text-right">Mentioned brand</TableHead>
									<TableHead className="text-right">Mention rate</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{stats.engines.map((row) => (
									<TableRow key={row.target}>
										<TableCell className="font-medium">{row.label}</TableCell>
										<TableCell className="text-right tabular-nums">{row.runs.toLocaleString()}</TableCell>
										<TableCell className="text-right tabular-nums">{row.mentioned.toLocaleString()}</TableCell>
										<TableCell className="text-right tabular-nums">{row.mentionRate}%</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</SectionCard>

			<SectionCard
				title="By prompt"
				action={
					<CsvExportButton
						rows={stats.prompts}
						fileNameParts={[brandName, "by-prompt"]}
						columns={[
							{ header: "Prompt", value: (row) => row.value },
							{ header: "Status", value: (row) => (row.enabled ? "On" : "Off") },
							{ header: "Prompts run", value: (row) => row.runs },
							{ header: "Mentioned brand", value: (row) => row.mentioned },
							{ header: "Mention rate %", value: (row) => row.mentionRate },
							{ header: "Last run", value: (row) => row.lastRun ?? "" },
						]}
					/>
				}
			>
				{stats.prompts.length === 0 ? (
					<p className="text-sm text-muted-foreground">No runs in this period.</p>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Prompt</TableHead>
									<TableHead className="text-right">Runs</TableHead>
									<TableHead className="text-right">Mentioned</TableHead>
									<TableHead className="text-right">Rate</TableHead>
									<TableHead className="text-right">Last run</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{stats.prompts.map((row) => (
									<TableRow key={row.promptId}>
										<TableCell className="max-w-md">
											<span className="line-clamp-2">{row.value}</span>
											{!row.enabled && <span className="ml-2 text-xs text-muted-foreground">(off)</span>}
										</TableCell>
										<TableCell className="text-right tabular-nums">{row.runs.toLocaleString()}</TableCell>
										<TableCell className="text-right tabular-nums">{row.mentioned.toLocaleString()}</TableCell>
										<TableCell className="text-right tabular-nums">{row.mentionRate}%</TableCell>
										<TableCell className="text-right tabular-nums">{formatDate(row.lastRun)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</SectionCard>
		</div>
	);
}

function StatisticsPage() {
	const { data: brand, isLoading: isLoadingBrand } = useBrand();
	const { days: daysParam } = useSearch({ strict: false }) as BrandFilterSearch;
	const setFilters = useFilterNavigate();
	const windowDays = daysParam ? clampWindowDays(Number(daysParam)) : DEFAULT_WINDOW_DAYS;
	const { data: stats, isLoading } = useBrandStatistics(brand?.id, windowDays);

	const setWindowDays = (days: number) => {
		setFilters({ days: days === DEFAULT_WINDOW_DAYS ? undefined : String(days) });
	};

	const brandName = brand?.name ?? "brand";

	return (
		<div className="flex flex-1 flex-col">
			<div className="m-auto flex w-full max-w-[1600px] flex-col gap-4 p-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-3xl font-bold">Statistics</h1>
						<p className="text-muted-foreground">
							How much data has been collected for {brandName}, and where it came from.
						</p>
					</div>
					<Button
						variant="outline"
						className="cursor-pointer print:hidden"
						onClick={() => {
							window.print();
						}}
					>
						<IconPrinter className="h-4 w-4 mr-1.5" />
						Print / Save as PDF
					</Button>
				</div>

				{/* Only visible when printed: the paper copy has no browser chrome to say what it is. */}
				<div className="hidden print:block border-b pb-2 mb-2">
					<p className="text-sm">
						{brandName} — {describeWindow(windowDays)}
						{stats ? ` (${stats.fromDate} to ${stats.toDate})` : ""}
					</p>
					<p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
				</div>

				<Card className="shadow-none py-4 print:hidden">
					<CardContent>
						<WindowSlider
							days={windowDays}
							onChange={setWindowDays}
							fromDate={stats?.fromDate}
							toDate={stats?.toDate}
						/>
					</CardContent>
				</Card>

				{isLoadingBrand || isLoading || !stats ? (
					<StatisticsSkeleton />
				) : (
					<StatisticsContent stats={stats} brandName={brandName} />
				)}
			</div>
		</div>
	);
}
