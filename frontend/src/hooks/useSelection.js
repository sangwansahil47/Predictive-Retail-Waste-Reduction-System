import { useCallback, useMemo, useState } from "react";

/**
 * Checkbox selection for a list shown in pages.
 * pageIds: ids visible on the current page; allIds: every id matching the filters.
 */
export default function useSelection(pageIds, allIds) {
  const [selected, setSelected] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pageSelectedCount = useMemo(() => pageIds.filter((id) => selected.has(id)).length, [pageIds, selected]);
  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const togglePage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const everyOnPage = pageIds.length > 0 && pageIds.every((id) => next.has(id));
      pageIds.forEach((id) => (everyOnPage ? next.delete(id) : next.add(id)));
      return next;
    });
  }, [pageIds]);

  const selectAll = useCallback(() => setSelected(new Set(allIds)), [allIds]);
  const clear = useCallback(() => setSelected(new Set()), []);

  return {
    selected,
    selectedIds: useMemo(() => [...selected], [selected]),
    count: selected.size,
    isSelected: (id) => selected.has(id),
    toggle,
    togglePage,
    selectAll,
    clear,
    allPageSelected,
    somePageSelected,
    allSelected,
  };
}
