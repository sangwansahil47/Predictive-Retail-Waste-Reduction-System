// Reads just the start of a CSV in the browser: which separator it uses, its
// column names and a few example rows. Nothing is uploaded yet.

const SEPARATORS = [
  { value: ",", char: "," },
  { value: ";", char: ";" },
  { value: "tab", char: "\t" },
  { value: "|", char: "|" },
];

// Splits one CSV line, honouring "quoted, values" and "" escapes.
const splitLine = (line, char) => {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === char) {
      cells.push(cell);
      cell = "";
    } else cell += c;
  }
  cells.push(cell);
  return cells.map((v) => v.trim());
};

const PREVIEW_BYTES = 64 * 1024;

export const readCsvPreview = async (file, exampleRows = 3) => {
  const text = await file.slice(0, PREVIEW_BYTES).text();
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) throw new Error("This file is empty.");

  const headerLine = lines[0];
  const separator = SEPARATORS.reduce((best, s) =>
    headerLine.split(s.char).length > headerLine.split(best.char).length ? s : best,
  );
  const headers = splitLine(headerLine, separator.char).filter((h) => h !== "");
  if (headers.length < 2) {
    throw new Error("Couldn't find the column names in the first line of this file.");
  }

  const rows = lines
    .slice(1, 1 + exampleRows)
    .map((line) => splitLine(line, separator.char))
    .map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));

  return { separator: separator.value, headers, rows };
};
