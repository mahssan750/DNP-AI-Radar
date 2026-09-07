/**
 * Minimal CSV writer and download trigger.
 *
 * Rows are built from data the page has already loaded, so exporting adds no
 * server round-trip and cannot affect data collection.
 */

export interface CsvColumn<Row> {
	header: string;
	value: (row: Row) => string | number | boolean | null | undefined;
}

/**
 * Excel reads a leading `=`, `+`, `-` or `@` as a formula, so those cells are
 * prefixed with a single quote before quoting.
 */
function escapeCell(raw: string | number | boolean | null | undefined): string {
	if (raw === null || raw === undefined) return '""';
	const text = String(raw);
	const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
	return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
	const lines = [columns.map((column) => escapeCell(column.header)).join(",")];
	for (const row of rows) {
		lines.push(columns.map((column) => escapeCell(column.value(row))).join(","));
	}
	// CRLF and a UTF-8 BOM are what Excel expects; without the BOM it mangles
	// accented characters in prompt text.
	return `﻿${lines.join("\r\n")}\r\n`;
}

/** Turn a name into a safe, readable filename stem. */
export function csvFileName(parts: (string | null | undefined)[], date = new Date()): string {
	const stem = parts
		.filter(Boolean)
		.join("-")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `${stem || "export"}-${date.toISOString().slice(0, 10)}.csv`;
}

export function downloadCsv(fileName: string, csv: string): void {
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function exportCsv<Row>(
	fileNameParts: (string | null | undefined)[],
	rows: Row[],
	columns: CsvColumn<Row>[],
): void {
	downloadCsv(csvFileName(fileNameParts), toCsv(rows, columns));
}
