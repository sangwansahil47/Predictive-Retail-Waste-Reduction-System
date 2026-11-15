import Button from "./Button.jsx";
import { formatNumber } from "../utils/format.js";

/**
 * Shown above a list once something is ticked: how many are selected, the option
 * to extend a page selection to every page, and the delete button.
 */
export default function SelectionBar({ selection, totalCount, pageCount, noun, pluralNoun = `${noun}s`, onDelete }) {
  // Always rendered (never pops in), so ticking a row doesn't push the list down.
  if (totalCount === 0) return null;
  const plural = (n) => `${formatNumber(n)} ${n === 1 ? noun : pluralNoun}`;
  const canSelectAll = !selection.allSelected && totalCount > pageCount;

  if (selection.count === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted">Tick {pluralNoun} to select them, or use the box in the header to select a whole page.</span>
        <Button variant="danger" size="sm" disabled className="opacity-50">
          Delete selected
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-ink">{plural(selection.count)} selected</span>
        {selection.allPageSelected && canSelectAll && (
          <button className="font-medium text-ink underline" onClick={selection.selectAll}>
            Select all {plural(totalCount)} on all pages
          </button>
        )}
        {!selection.allPageSelected && canSelectAll && (
          <button className="text-muted underline hover:text-ink" onClick={selection.selectAll}>
            Select all {plural(totalCount)}
          </button>
        )}
        {selection.allSelected && totalCount > pageCount && (
          <span className="text-muted">All pages selected</span>
        )}
        <button className="text-muted underline hover:text-ink" onClick={selection.clear}>
          Clear selection
        </button>
      </div>
      <Button variant="danger" size="sm" onClick={onDelete}>
        Delete selected ({formatNumber(selection.count)})
      </Button>
    </div>
  );
}
