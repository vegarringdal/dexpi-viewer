import { Button } from "@tredespace/ui/widgets";
import type { JSX } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type FieldToggleRowProps<T extends string> = Readonly<{
  label: string;
  fields: readonly T[];
  labels: Readonly<Record<T, string>>;
  active: ReadonlySet<T>;
  /** Keep at least one field active (clicking the last one off is a no-op). */
  requireOne?: boolean;
  onChange: (next: ReadonlySet<T>) => void;
}>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** A labelled row of multi-select chip toggles over a fixed field list. */
export function FieldToggleRow<T extends string>({
  label,
  fields,
  labels,
  active,
  requireOne = false,
  onChange,
}: FieldToggleRowProps<T>): JSX.Element {
  const handleToggle = (field: T): void => {
    if (requireOne && active.has(field) && active.size === 1) {
      return;
    }

    const next = new Set(active);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
    }
    onChange(next);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <span className="w-14 text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      {fields.map((field) => (
        <Button key={field} active={active.has(field)} onClick={() => handleToggle(field)}>
          {labels[field]}
        </Button>
      ))}
    </div>
  );
}
