import { useRouteContext } from "@tanstack/react-router";
import type { ClientConfig } from "@workspace/config/types";

/** The deployment-wide gap between prompt cycles, used when a brand sets no override. */
export function useDefaultDelayHours(): number {
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	return context.clientConfig?.defaultDelayHours ?? 24;
}
