import { useState } from "react";
import { CSV_FIELDS, DATE_FIELD_KEYS, DATE_FORMATS, missingRequiredFields, normalizeHeader } from "../utils/csvFields.js";
import Checkbox from "./Checkbox.jsx";

const NOT_IN_FILE = "";

/**
 * Lets the user match their file's columns to the fields the app needs.
 * preview: { headers, rows } from readCsvPreview; mapping: { fieldKey: "File column" }.
 */
export default function ColumnMatcher({
  type,
  fileName,
  preview,
  mapping,
  onMappingChange,
  dateFormat,
  onDateFormatChange,
  remember,
  onRememberChange,
  disabled,
}) {
  const fields = CSV_FIELDS[type];
  const missing = missingRequiredFields(type, mapping);
  const alreadyInAppFormat =
    missing.length === 0 &&
    fields.every((f) => !mapping[f.key] || normalizeHeader(mapping[f.key]) === normalizeHeader(f.key));
  const [expanded, setExpanded] = useState(!alreadyInAppFormat);

  const usedBy = new Map(Object.entries(mapping).map(([field, column]) => [column, field]));
  const labelOf = (key) => fields.find((f) => f.key === key)?.label;
  const example = (column) => preview.rows.find((row) => row[column])?.[column] ?? "";
  const hasDateField = DATE_FIELD_KEYS.some((key) => mapping[key]);
  const unusedColumns = preview.headers.filter((h) => !usedBy.has(h));

  const setField = (key, column) => {
    const next = { ...mapping };
    if (column === NOT_IN_FILE) delete next[key];
    else next[key] = column;
    onMappingChange(next);
  };

  if (!expanded) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-emerald-50 px-4 py-3 text-sm">
        <span className="text-emerald-700">
          All columns in <strong>{fileName}</strong> matched automatically.
        </span>
        <button className="font-medium text-ink underline" onClick={() => setExpanded(true)} disabled={disabled}>
          Review matching
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-hairline">
      <div className="border-b border-hairline px-4 py-3">
        <h3 className="font-display text-base text-ink">Match your columns</h3>
        <p className="mt-0.5 text-sm text-muted">
          Choose which column in <strong className="text-ink">{fileName}</strong> holds each piece of information.
          We've matched what we could. Columns you don't match are ignored.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft">
              <th className="px-4 py-2.5 font-medium text-muted">App needs</th>
              <th className="px-4 py-2.5 font-medium text-muted">Column in your file</th>
              <th className="px-4 py-2.5 font-medium text-muted">Example from your file</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline-soft">
            {fields.map((field) => {
              const column = mapping[field.key] ?? NOT_IN_FILE;
              const isMissing = field.required && !column;
              return (
                <tr key={field.key} className={isMissing ? "bg-red-50/60" : ""}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink">
                    {field.label}
                    {field.required ? (
                      <span className="ml-0.5 text-danger" title="Required">
                        *
                      </span>
                    ) : (
                      <span className="ml-1.5 text-xs text-muted">optional</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      aria-label={`Column for ${field.label}`}
                      value={column}
                      disabled={disabled}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className={`h-9 w-full min-w-[180px] rounded-md border bg-canvas px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        isMissing ? "border-danger" : "border-hairline focus:border-ink"
                      }`}
                    >
                      <option value={NOT_IN_FILE}>{field.required ? "Choose a column..." : "Not in my file"}</option>
                      {preview.headers.map((header) => {
                        const owner = usedBy.get(header);
                        const takenByOther = owner && owner !== field.key;
                        return (
                          <option key={header} value={header} disabled={takenByOther}>
                            {header}
                            {takenByOther ? ` (used for ${labelOf(owner)})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-xs text-muted" title={example(column)}>
                    {column ? example(column) || <span className="italic">empty</span> : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-hairline px-4 py-3">
        {hasDateField && (
          <label className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:gap-3">
            <span className="font-medium text-ink">Dates in this file are written as</span>
            <select
              value={dateFormat}
              disabled={disabled}
              onChange={(e) => onDateFormatChange(e.target.value)}
              className="h-9 rounded-md border border-hairline bg-canvas px-2.5 text-sm text-ink focus:border-ink focus:outline-none"
            >
              {DATE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {unusedColumns.length > 0 && (
          <p className="text-xs text-muted">
            Ignored columns: {unusedColumns.join(", ")}
          </p>
        )}

        {missing.length > 0 && (
          <p className="text-sm text-danger" role="alert">
            Choose a column for: {missing.map((f) => f.label).join(", ")}
          </p>
        )}

        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox checked={remember} onChange={(e) => onRememberChange(e.target.checked)} disabled={disabled} />
          Remember this matching for my next {type === "inventory" ? "inventory" : type} file
        </label>
      </div>
    </div>
  );
}
