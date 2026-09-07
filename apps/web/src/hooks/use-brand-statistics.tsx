import { useQuery } from "@tanstack/react-query";
import { ALL_MODELS_VALUE } from "@workspace/config/model-filter";
import { useResolvedBrandId } from "@/hooks/use-brand-id";
import { getBrandStatisticsFn } from "@/server/statistics";

export const statisticsKeys = {
	all: ["statistics"] as const,
	brand: (brandId: string, windowDays: number, model: string) =>
		[...statisticsKeys.all, brandId, windowDays, model] as const,
};

export function useBrandStatistics(brandId: string | undefined, windowDays: number, model: string = ALL_MODELS_VALUE) {
	const resolvedBrandId = useResolvedBrandId(brandId);

	const query = useQuery({
		queryKey: statisticsKeys.brand(resolvedBrandId || "", windowDays, model),
		queryFn: () =>
			getBrandStatisticsFn({
				data: {
					brandId: resolvedBrandId!,
					windowDays,
					model: model === ALL_MODELS_VALUE ? undefined : model,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				},
			}),
		enabled: !!resolvedBrandId,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		// Keep the previous window on screen while the slider's new one loads,
		// so dragging doesn't flash the page back to skeletons.
		placeholderData: (prev) => prev,
	});

	return {
		data: query.data,
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		error: query.error,
		refetch: query.refetch,
	};
}
