import type { RawRecipient } from "./types";

/**
 * Parse a CSV or pasted recipient list into raw rows. Deliberately does no
 * validation — that's `validate.ts`'s job. This only splits the text into
 * `(line, addressInput, amountInput)` triples, tolerating the real-world mess
 * of hand-made CSVs.
 *
 * Accepts: `address,amount` per line, comma/semicolon/tab/whitespace
 * separated, optional header row, CRLF or LF, a leading UTF-8 BOM, blank
 * lines, and surrounding whitespace. A line with only an address (no amount)
 * is preserved as a `missing-fields` candidate rather than silently dropped,
 * so validation can report it against the right line number.
 */

const SEPARATOR = /[,;\t]+|\s{2,}| +/;

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeHeader(fields: string[]): boolean {
  // A header has no 0x-address in it; a data row's first field starts 0x.
  const first = fields[0]?.toLowerCase() ?? "";
  return !first.startsWith("0x");
}

export function parseRecipients(input: string): RawRecipient[] {
  const text = stripBom(input);
  const lines = text.split(/\r?\n/);
  const rows: RawRecipient[] = [];

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (line === "") return;

    const fields = line
      .split(SEPARATOR)
      .map((f) => f.trim())
      .filter(Boolean);

    // Skip a header row, but only if it's the first non-empty line.
    if (rows.length === 0 && looksLikeHeader(fields)) return;

    rows.push({
      line: i + 1,
      addressInput: fields[0] ?? "",
      amountInput: fields[1] ?? "",
    });
  });

  return rows;
}
