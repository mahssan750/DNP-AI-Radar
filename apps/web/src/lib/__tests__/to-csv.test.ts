import { describe, expect, it } from "vitest";
import { csvFileName, toCsv } from "@/lib/to-csv";

const BOM = "﻿";

describe("toCsv", () => {
	it("writes a header row and one row per record", () => {
		const csv = toCsv(
			[{ name: "chatgpt", runs: 12 }],
			[
				{ header: "Engine", value: (row) => row.name },
				{ header: "Runs", value: (row) => row.runs },
			],
		);

		expect(csv).toBe(`${BOM}"Engine","Runs"\r\n"chatgpt","12"\r\n`);
	});

	it("keeps commas, quotes and newlines inside a single field", () => {
		const csv = toCsv(
			[{ text: 'best "cheap" tools, ranked\nby price' }],
			[{ header: "Prompt", value: (row) => row.text }],
		);

		expect(csv).toBe(`${BOM}"Prompt"\r\n"best ""cheap"" tools, ranked\nby price"\r\n`);
	});

	it("stops a spreadsheet treating a leading = as a formula", () => {
		const csv = toCsv([{ text: "=1+1" }], [{ header: "Prompt", value: (row) => row.text }]);

		expect(csv).toContain(`"'=1+1"`);
	});

	it("writes empty cells for missing values", () => {
		const csv = toCsv([{ last: null }], [{ header: "Last run", value: (row) => row.last }]);

		expect(csv).toBe(`${BOM}"Last run"\r\n""\r\n`);
	});

	it("still emits the header when there are no rows", () => {
		const csv = toCsv<{ name: string }>([], [{ header: "Engine", value: (row) => row.name }]);

		expect(csv).toBe(`${BOM}"Engine"\r\n`);
	});
});

describe("csvFileName", () => {
	it("joins the parts and stamps the date", () => {
		expect(csvFileName(["Acme Corp", "by-prompt"], new Date("2026-09-07T10:00:00Z"))).toBe(
			"acme-corp-by-prompt-2026-09-07.csv",
		);
	});

	it("drops missing parts and collapses punctuation", () => {
		expect(csvFileName([undefined, "Ünsafe / name!"], new Date("2026-01-02T00:00:00Z"))).toBe(
			"nsafe-name-2026-01-02.csv",
		);
	});
});
