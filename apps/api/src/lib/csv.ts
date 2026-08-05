/** Escape a single CSV cell (RFC 4180-style quoting). */
export function csvEscape(value: string | number | boolean | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

/** Build a CSV string from header + row arrays. */
export function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}
