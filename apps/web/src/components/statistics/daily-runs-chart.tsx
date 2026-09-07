import { type ChartConfig, ChartContainer, ChartTooltip } from "@workspace/ui/components/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { StatisticsDailyPoint } from "@/server/statistics";

/** Build a local Date from a "YYYY-MM-DD" string (avoids the UTC off-by-one of `new Date(iso)`). */
function localDate(value: string): Date {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year, month - 1, day);
}

const CONFIG = {
	runs: { label: "Prompts run", color: "#2563eb" },
} satisfies ChartConfig;

export function DailyRunsChart({
	data,
	className = "aspect-auto h-64 w-full",
}: {
	data: StatisticsDailyPoint[];
	className?: string;
}) {
	return (
		<ChartContainer config={CONFIG} className={className}>
			<BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
				<CartesianGrid vertical={false} strokeDasharray="3 3" />
				<XAxis
					dataKey="date"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					minTickGap={40}
					tick={{ fontSize: 11 }}
					tickFormatter={(value: string) =>
						localDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
					}
				/>
				<YAxis
					domain={[0, "auto"]}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					tickCount={4}
					tick={{ fontSize: 11 }}
					allowDecimals={false}
				/>
				<ChartTooltip
					isAnimationActive={false}
					cursor={false}
					content={({ active, payload, label }) => {
						if (!active || !payload?.length) return null;
						const point = payload[0]?.payload as StatisticsDailyPoint | undefined;
						if (!point) return null;
						return (
							<div className="border-border/50 bg-background grid min-w-[12rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
								<div className="font-medium">
									{localDate(label as string).toLocaleDateString("en-US", {
										month: "long",
										day: "numeric",
										year: "numeric",
									})}
								</div>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">Prompts run</span>
									<span className="ml-auto font-mono tabular-nums">{point.runs}</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">Mentioned your brand</span>
									<span className="ml-auto font-mono tabular-nums">{point.mentioned}</span>
								</div>
							</div>
						);
					}}
				/>
				<Bar dataKey="runs" fill="#2563eb" radius={[2, 2, 0, 0]} />
			</BarChart>
		</ChartContainer>
	);
}
