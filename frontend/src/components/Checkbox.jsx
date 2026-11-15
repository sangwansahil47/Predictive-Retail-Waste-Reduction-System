import { useEffect, useRef } from "react";

export default function Checkbox({ checked, indeterminate = false, onChange, label, disabled = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer rounded border-hairline accent-ink disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}
