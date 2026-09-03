import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from "@tabler/icons-react";
import { Button, Checkbox, ColorSelect, TextArea, TextInput } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import type { CustomHighlightFilter } from "../../lib/dexpi/customHighlightFilter.ts";
import {
  addCustomFilterCondition,
  moveCustomFilter,
  removeCustomFilter,
  removeCustomFilterCondition,
  setCustomFilterAdvanced,
  updateCustomFilter,
  updateCustomFilterCondition,
} from "../../state/highlight/highlight.actions.ts";
import { CustomHighlightConditionRow } from "./CustomHighlightConditionRow.tsx";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ADVANCED_PLACEHOLDER = "TYPE = 'somevalue' & (ATTR('FluidCode') = 'A*' | ATTR('FluidCode') != 'B*')";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type CustomHighlightFilterRowProps = Readonly<{
  filter: CustomHighlightFilter;
  matchCount: number;
  matchError?: string | undefined;
  isFirst: boolean;
  isLast: boolean;
}>;

/** One custom-highlight filter: its match rule (simple AND-list or advanced &/| expression), color, and priority controls. */
export function CustomHighlightFilterRow({
  filter,
  matchCount,
  matchError,
  isFirst,
  isLast,
}: CustomHighlightFilterRowProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 rounded border border-slate-800 p-2">
      <div className="flex items-center gap-1.5">
        <Checkbox
          checked={filter.enabled}
          onChange={(enabled) => updateCustomFilter(filter.id, { enabled })}
        />
        <TextInput
          value={filter.label}
          onChange={(label) => updateCustomFilter(filter.id, { label })}
          placeholder="Filter name"
          className="flex-1"
        />
        <span className="whitespace-nowrap text-[10px] text-slate-500">{matchCount}</span>
        <Button
          active={!filter.advanced}
          onClick={() => setCustomFilterAdvanced(filter.id, false)}
          tooltip="Simple mode: conditions combined with AND"
        >
          Simple
        </Button>
        <Button
          active={filter.advanced}
          onClick={() => setCustomFilterAdvanced(filter.id, true)}
          tooltip="Advanced mode: write your own &/| expression"
        >
          Advanced
        </Button>
        <Button
          icon={<IconChevronUp />}
          iconOnly
          disabled={isFirst}
          onClick={() => moveCustomFilter(filter.id, "up")}
          tooltip="Move up (lower priority)"
        />
        <Button
          icon={<IconChevronDown />}
          iconOnly
          disabled={isLast}
          onClick={() => moveCustomFilter(filter.id, "down")}
          tooltip="Move down (higher priority — wins color overlaps below it)"
        />
        <Button
          icon={<IconTrash />}
          iconOnly
          onClick={() => removeCustomFilter(filter.id)}
          tooltip="Remove filter"
        />
      </div>
      {filter.advanced ? (
        <div className="flex items-start gap-1.5">
          <TextArea
            value={filter.expression}
            onChange={(expression) => updateCustomFilter(filter.id, { expression })}
            placeholder={ADVANCED_PLACEHOLDER}
            rows={3}
            minHeight={60}
            className="flex-1"
          />
          <ColorSelect
            value={filter.colorHex}
            onChange={(colorHex) => updateCustomFilter(filter.id, { colorHex })}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filter.conditions.map((condition) => (
            <CustomHighlightConditionRow
              key={condition.id}
              condition={condition}
              canRemove={filter.conditions.length > 1}
              onChange={(patch) => updateCustomFilterCondition(filter.id, condition.id, patch)}
              onRemove={() => removeCustomFilterCondition(filter.id, condition.id)}
            />
          ))}
          <div className="flex items-center gap-1.5">
            <Button
              icon={<IconPlus />}
              onClick={() => addCustomFilterCondition(filter.id)}
              tooltip="Add AND condition"
            >
              Add condition
            </Button>
            <ColorSelect
              value={filter.colorHex}
              onChange={(colorHex) => updateCustomFilter(filter.id, { colorHex })}
            />
          </div>
        </div>
      )}
      {matchError && <div className="text-red-400 text-xs">{matchError}</div>}
    </div>
  );
}
