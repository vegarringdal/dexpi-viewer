import { IconX } from "@tabler/icons-react";
import { Button, Select, type SelectOption, TextInput } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import type {
  CustomFilterCondition,
  CustomFilterField,
  CustomFilterOperator,
} from "../../lib/dexpi/customHighlightFilter.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FIELD_OPTIONS: SelectOption[] = [
  { value: "type", label: "Type" },
  { value: "attribute", label: "Attribute" },
  { value: "id", label: "ID" },
  { value: "persistentId", label: "Persistent ID" },
  { value: "xpath", label: "XPath" },
];

const OPERATOR_OPTIONS: SelectOption[] = [
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Does not contain" },
  { value: "equals", label: "Equals (* wildcard)" },
  { value: "notEquals", label: "Does not equal (* wildcard)" },
];

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function isFilterField(value: string | null): value is CustomFilterField {
  return (
    value === "type" ||
    value === "attribute" ||
    value === "id" ||
    value === "persistentId" ||
    value === "xpath"
  );
}

/** XPath is the one field where a trailing `*` has a special reading (object + all children) worth hinting at. */
function valuePlaceholder(field: CustomFilterField): string {
  return field === "xpath" ? "/Model/Object[2]* for the object and all its children" : "Value";
}

function isFilterOperator(value: string | null): value is CustomFilterOperator {
  return value === "contains" || value === "notContains" || value === "equals" || value === "notEquals";
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type CustomHighlightConditionRowProps = Readonly<{
  condition: CustomFilterCondition;
  canRemove: boolean;
  onChange: (patch: Partial<CustomFilterCondition>) => void;
  onRemove: () => void;
}>;

/** One AND-ed condition inside a custom highlight filter's simple-mode rule. */
export function CustomHighlightConditionRow({
  condition,
  canRemove,
  onChange,
  onRemove,
}: CustomHighlightConditionRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={condition.field}
        onChange={(value) => onChange({ field: isFilterField(value) ? value : "type" })}
        options={FIELD_OPTIONS}
        className="w-24"
      />
      {condition.field === "attribute" && (
        <TextInput
          value={condition.attributeName}
          onChange={(attributeName) => onChange({ attributeName })}
          placeholder="Attribute name"
          className="w-28"
        />
      )}
      <Select
        value={condition.operator}
        onChange={(value) => onChange({ operator: isFilterOperator(value) ? value : "contains" })}
        options={OPERATOR_OPTIONS}
        className="w-36"
      />
      <TextInput
        value={condition.value}
        onChange={(value) => onChange({ value })}
        placeholder={valuePlaceholder(condition.field)}
        className="flex-1"
      />
      <Button icon={<IconX />} iconOnly onClick={onRemove} disabled={!canRemove} tooltip="Remove condition" />
    </div>
  );
}
