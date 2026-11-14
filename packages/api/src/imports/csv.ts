/**
 * Parses CSV text into rows of fields. Handles quoted fields, doubled quotes inside them, and
 * line breaks inside quotes, which exported reviews are full of.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endRow = () => {
    row.push(field);
    field = "";
    // A blank line is not a row.
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = false;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") endRow();
    else if (char !== "\r") field += char;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

export type CsvRecord = Record<string, string>;

/**
 * Reads CSV text whose first row names the columns. Column names are lowercased, because
 * services change their capitals between export versions.
 */
export function readTable(text: string): { columns: string[]; records: CsvRecord[] } {
  // Files saved by spreadsheet apps often start with a byte order mark.
  const [header = [], ...rows] = parseCsv(text.replace(/^﻿/, ""));
  const columns = header.map((name) => name.trim().toLowerCase());
  const records = rows.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, (row[index] ?? "").trim()])),
  );
  return { columns, records };
}

/** The first of the named columns that has a value in this record. */
export function cell(record: CsvRecord, ...columns: string[]): string | null {
  for (const column of columns) {
    const value = record[column];
    if (value) return value;
  }
  return null;
}
