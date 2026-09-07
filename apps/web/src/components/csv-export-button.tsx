import { IconDownload } from "@tabler/icons-react";
import { Button } from "@workspace/ui/components/button";
import { type CsvColumn, exportCsv } from "@/lib/to-csv";

/**
 * Downloads whatever the page has already loaded as a spreadsheet. No server
 * round-trip, so the export can never disturb data collection.
 */
export function CsvExportButton<Row>({
	rows,
	columns,
	fileNameParts,
	label = "CSV",
	className = "",
}: {
	rows: Row[];
	columns: CsvColumn<Row>[];
	/** Joined and slugified into the filename, with today's date appended. */
	fileNameParts: (string | null | undefined)[];
	label?: string;
	className?: string;
}) {
	return (
		<Button
			type="button"
			size="sm"
			variant="secondary"
			className={`h-7 cursor-pointer text-xs print:hidden ${className}`}
			disabled={rows.length === 0}
			title={rows.length === 0 ? "Nothing to export yet" : "Download as a spreadsheet"}
			onClick={() => exportCsv(fileNameParts, rows, columns)}
		>
			<IconDownload className="size-3.5 mr-1" />
			{label}
		</Button>
	);
}
