/** Server function behind the Statistics page. */
import { createServerFn } from "@tanstack/react-start";
import { labelForModelFilter } from "@workspace/config/model-filter";
import { db } from "@workspace/lib/db/db";
import { prompts } from "@workspace/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireBrandSession } from "@/lib/auth/helpers";
import {
	getCitationTotals,
	getDailyRunCounts,
	getEngineRunStats,
	getLifetimeRunCount,
	getPromptRunStats,
	getStatisticsTotals,
} from "@/lib/postgres-read";
import { MAX_WINDOW_DAYS, MIN_WINDOW_DAYS } from "@/lib/statistics-window";
import { getTimezoneDayRange, resolveTimezone } from "@/lib/timezone-utils";

export interface StatisticsDailyPoint {
	date: string;
	runs: number;
	mentioned: number;
}

export interface StatisticsEngineRow {
	/** Model-filter value, so the row can be labelled and icon-matched like everywhere else. */
	target: string;
	label: string;
	runs: number;
	mentioned: number;
	mentionRate: number;
}

export interface StatisticsPromptRow {
	promptId: string;
	value: string;
	enabled: boolean;
	runs: number;
	mentioned: number;
	mentionRate: number;
	lastRun: string | null;
}

export interface BrandStatisticsResponse {
	windowDays: number;
	fromDate: string;
	toDate: string;
	lifetimeRuns: number;
	runs: number;
	promptsRun: number;
	mentionedRuns: number;
	mentionRate: number;
	firstRun: string | null;
	lastRun: string | null;
	activeDays: number;
	promptsTracked: number;
	promptsEnabled: number;
	totalCitations: number;
	uniqueDomains: number;
	daily: StatisticsDailyPoint[];
	engines: StatisticsEngineRow[];
	prompts: StatisticsPromptRow[];
}

function rate(part: number, whole: number): number {
	return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export const getBrandStatisticsFn = createServerFn({ method: "GET" })
	.validator(
		z.object({
			brandId: z.string(),
			windowDays: z.number().int().min(MIN_WINDOW_DAYS).max(MAX_WINDOW_DAYS).default(30),
			/** Absent means every platform; otherwise a model-filter value. */
			model: z.string().optional(),
			timezone: z.string().default("UTC"),
		}),
	)
	.handler(async ({ data }): Promise<BrandStatisticsResponse> => {
		await requireBrandSession(data.brandId);

		const timezone = resolveTimezone(data.timezone);
		const { fromDateStr, toDateStr } = getTimezoneDayRange(data.windowDays, timezone);

		const brandPrompts = await db
			.select({ id: prompts.id, value: prompts.value, enabled: prompts.enabled })
			.from(prompts)
			.where(eq(prompts.brandId, data.brandId));
		const enabledPromptIds = brandPrompts.filter((p) => p.enabled).map((p) => p.id);

		// Statistics count what actually ran, including prompts since disabled, so
		// no prompt-id filter is applied to the run queries.
		const [totals, lifetimeRuns, daily, engines, promptStats, citations, enabledCount] = await Promise.all([
			getStatisticsTotals(data.brandId, fromDateStr, toDateStr, timezone, undefined, data.model),
			getLifetimeRunCount(data.brandId),
			getDailyRunCounts(data.brandId, fromDateStr, toDateStr, timezone, undefined, data.model),
			getEngineRunStats(data.brandId, fromDateStr, toDateStr, timezone),
			getPromptRunStats(data.brandId, fromDateStr, toDateStr, timezone, undefined, data.model),
			getCitationTotals(data.brandId, fromDateStr, toDateStr, timezone),
			db
				.select({ id: prompts.id })
				.from(prompts)
				.where(and(eq(prompts.brandId, data.brandId), eq(prompts.enabled, true))),
		]);

		const promptText = new Map(brandPrompts.map((p) => [p.id, p]));

		return {
			windowDays: data.windowDays,
			fromDate: fromDateStr,
			toDate: toDateStr,
			lifetimeRuns,
			runs: totals.total_runs,
			promptsRun: totals.total_prompts,
			mentionedRuns: totals.brand_mentioned_runs,
			mentionRate: rate(totals.brand_mentioned_runs, totals.total_runs),
			firstRun: totals.total_runs > 0 ? totals.first_run : null,
			lastRun: totals.total_runs > 0 ? totals.last_run : null,
			activeDays: totals.active_days,
			promptsTracked: brandPrompts.length,
			promptsEnabled: enabledCount.length,
			totalCitations: citations.total_citations,
			uniqueDomains: citations.unique_domains,
			daily: daily.map((row) => ({
				date: typeof row.date === "string" ? row.date : new Date(row.date).toISOString().slice(0, 10),
				runs: row.total_runs,
				mentioned: row.brand_mentioned_count,
			})),
			engines: engines.map((row) => {
				const target = row.grounded ? `${row.model}::premium` : row.model;
				return {
					target,
					label: labelForModelFilter(target),
					runs: row.total_runs,
					mentioned: row.brand_mentioned_count,
					mentionRate: rate(row.brand_mentioned_count, row.total_runs),
				};
			}),
			prompts: promptStats.map((row) => {
				const prompt = promptText.get(row.prompt_id);
				return {
					promptId: row.prompt_id,
					value: prompt?.value ?? "(deleted prompt)",
					enabled: prompt?.enabled ?? false,
					runs: row.total_runs,
					mentioned: row.brand_mentioned_count,
					mentionRate: rate(row.brand_mentioned_count, row.total_runs),
					lastRun: row.last_run,
				};
			}),
		};
	});
