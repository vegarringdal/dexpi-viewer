import { fail, ok, type Result } from "../result.ts";
import type { PlantNode } from "./plantModel.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CustomFilterField = "type" | "attribute" | "id" | "persistentId" | "xpath";
export type CustomFilterOperator = "equals" | "contains" | "notEquals" | "notContains";

type ConditionMatch = Readonly<{
  field: CustomFilterField;
  /** Attribute name to match; only meaningful when `field === "attribute"`. */
  attributeName: string;
  operator: CustomFilterOperator;
  value: string;
}>;

export type CustomFilterCondition = Readonly<{ id: string }> & ConditionMatch;

export type CustomHighlightFilter = Readonly<{
  id: string;
  label: string;
  colorHex: string;
  enabled: boolean;
  /** True = evaluate `expression`; false = AND every condition in `conditions`.
   *  Both fields are always kept (not a strict discriminated union) so toggling
   *  the mode never discards the other one's work. */
  advanced: boolean;
  conditions: readonly CustomFilterCondition[];
  expression: string;
}>;

export type CustomFilterMatch = Readonly<{
  filterId: string;
  objectIds: readonly string[];
  /** Set when `expression` failed to parse — the filter matched nothing. */
  error?: string | undefined;
}>;

type FilterExpr =
  | Readonly<{ kind: "and"; left: FilterExpr; right: FilterExpr }>
  | Readonly<{ kind: "or"; left: FilterExpr; right: FilterExpr }>
  | (Readonly<{ kind: "condition" }> & ConditionMatch);

// -----------------------------------------------------------------------------
// Condition matching (shared by simple mode and advanced-expression leaves)
// -----------------------------------------------------------------------------

function fieldValue(node: PlantNode, field: CustomFilterField, attributeName: string): string | null {
  if (field === "type") {
    return node.typeName;
  }
  if (field === "id") {
    return node.id;
  }
  if (field === "xpath") {
    // Positional xpaths are ancestor-prefixed ("/Model/Object[2]/Components[1]/Object[4]"),
    // so a trailing "*" in a wildcard equals already matches the object and every descendant
    // — no separate "children" mode needed.
    return node.xpath;
  }
  if (field === "attribute") {
    return node.attributes.find((a) => a.name === attributeName)?.value ?? null;
  }
  return null; // "persistentId" is multi-valued — matched directly in matchesCondition.
}

/** Escapes regex metacharacters other than `*`, which becomes a `.*` wildcard. */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function matchesValue(actual: string, operator: CustomFilterOperator, value: string): boolean {
  const needle = value.trim();
  if (needle.length === 0) {
    return false;
  }
  if (operator === "contains") {
    return actual.toLowerCase().includes(needle.toLowerCase());
  }
  if (operator === "notContains") {
    return !actual.toLowerCase().includes(needle.toLowerCase());
  }
  if (operator === "notEquals") {
    return !globToRegExp(needle).test(actual);
  }
  return globToRegExp(needle).test(actual);
}

function isNegatedOperator(operator: CustomFilterOperator): boolean {
  return operator === "notEquals" || operator === "notContains";
}

function positiveOperator(operator: CustomFilterOperator): "equals" | "contains" {
  return operator === "contains" || operator === "notContains" ? "contains" : "equals";
}

/** An object without the field at all never matches — including the "not…" operators, so a
 *  "does not equal" condition on an attribute only lights up objects that actually carry it. */
function matchesCondition(node: PlantNode, condition: ConditionMatch): boolean {
  if (condition.field === "persistentId") {
    // Multi-valued (one per Context) — "does not…" means none of them match, not "some id lacks it".
    if (node.persistentIds.length === 0) {
      return false;
    }
    const anyMatches = node.persistentIds.some((p) =>
      matchesValue(p.value, positiveOperator(condition.operator), condition.value),
    );
    return isNegatedOperator(condition.operator) ? !anyMatches : anyMatches;
  }

  const actual = fieldValue(node, condition.field, condition.attributeName);
  return actual !== null && matchesValue(actual, condition.operator, condition.value);
}

/** Simple mode: every non-empty condition must match (AND). Empty conditions are ignored mid-edit. */
function matchesConditions(node: PlantNode, conditions: readonly CustomFilterCondition[]): boolean {
  const active = conditions.filter((c) => c.value.trim().length > 0);
  return active.length > 0 && active.every((c) => matchesCondition(node, c));
}

// -----------------------------------------------------------------------------
// Advanced expression parsing:
// TYPE / ID / XPATH / PERSISTENT_ID / ATTR('name')  = or != or CONTAINS  'value'
// combined with & | and parentheses.
// -----------------------------------------------------------------------------

class ParseError extends Error {}

type Token =
  | Readonly<{ kind: "ident"; value: string }>
  | Readonly<{ kind: "string"; value: string }>
  | Readonly<{ kind: "op"; value: "(" | ")" | "&" | "|" | "=" | "!=" }>;

function isOpChar(ch: string): ch is "(" | ")" | "&" | "|" | "=" {
  return ch === "(" || ch === ")" || ch === "&" || ch === "|" || ch === "=";
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] ?? "";
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "!") {
      if (input[i + 1] !== "=") {
        throw new ParseError(`Expected "=" after "!" at position ${i + 1}.`);
      }
      tokens.push({ kind: "op", value: "!=" });
      i += 2;
      continue;
    }
    if (isOpChar(ch)) {
      tokens.push({ kind: "op", value: ch });
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const end = input.indexOf(quote, i + 1);
      if (end === -1) {
        throw new ParseError(`Unterminated string starting at position ${i + 1}.`);
      }
      tokens.push({ kind: "string", value: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z_]/.test(input[j] ?? "")) {
        j += 1;
      }
      tokens.push({ kind: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new ParseError(`Unexpected character "${ch}" at position ${i + 1}.`);
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  hasMore(): boolean {
    return this.pos < this.tokens.length;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const token = this.tokens[this.pos];
    if (!token) {
      throw new ParseError("Unexpected end of expression.");
    }
    this.pos += 1;
    return token;
  }

  private expectOp(value: "(" | ")"): void {
    const token = this.next();
    if (token.kind !== "op" || token.value !== value) {
      throw new ParseError(`Expected "${value}".`);
    }
  }

  parseExpr(): FilterExpr {
    return this.parseOr();
  }

  private parseOr(): FilterExpr {
    let left = this.parseAnd();
    while (this.peek()?.kind === "op" && this.peek()?.value === "|") {
      this.next();
      left = { kind: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): FilterExpr {
    let left = this.parseTerm();
    while (this.peek()?.kind === "op" && this.peek()?.value === "&") {
      this.next();
      left = { kind: "and", left, right: this.parseTerm() };
    }
    return left;
  }

  private parseTerm(): FilterExpr {
    const token = this.peek();
    if (token?.kind === "op" && token.value === "(") {
      this.next();
      const inner = this.parseOr();
      this.expectOp(")");
      return inner;
    }
    return this.parseCondition();
  }

  private parseCondition(): FilterExpr {
    const fieldToken = this.next();
    if (fieldToken.kind !== "ident") {
      throw new ParseError("Expected TYPE, ID, XPATH, PERSISTENT_ID, or ATTR('name').");
    }

    const keyword = fieldToken.value.toUpperCase();
    let field: CustomFilterField;
    let attributeName = "";
    if (keyword === "TYPE") {
      field = "type";
    } else if (keyword === "ID") {
      field = "id";
    } else if (keyword === "XPATH") {
      field = "xpath";
    } else if (keyword === "PERSISTENT_ID") {
      field = "persistentId";
    } else if (keyword === "ATTR") {
      field = "attribute";
      this.expectOp("(");
      const nameToken = this.next();
      if (nameToken.kind !== "string") {
        throw new ParseError("Expected a quoted attribute name inside ATTR(...).");
      }
      attributeName = nameToken.value;
      this.expectOp(")");
    } else {
      throw new ParseError(
        `Unknown field "${fieldToken.value}" — use TYPE, ID, XPATH, PERSISTENT_ID, or ATTR('name').`,
      );
    }

    const opToken = this.next();
    let operator: CustomFilterOperator;
    if (opToken.kind === "op" && opToken.value === "=") {
      operator = "equals";
    } else if (opToken.kind === "op" && opToken.value === "!=") {
      operator = "notEquals";
    } else if (opToken.kind === "ident" && opToken.value.toUpperCase() === "CONTAINS") {
      operator = "contains";
    } else {
      throw new ParseError('Expected "=", "!=", or CONTAINS.');
    }

    const valueToken = this.next();
    if (valueToken.kind !== "string") {
      throw new ParseError("Expected a quoted value.");
    }

    return { kind: "condition", field, attributeName, operator, value: valueToken.value };
  }
}

/** Parses an advanced-mode expression (see `CustomHighlightFilter.expression`) into an evaluable AST. */
export function parseFilterExpression(expression: string): Result<FilterExpr> {
  try {
    const tokens = tokenize(expression);
    if (tokens.length === 0) {
      return fail("Empty expression.");
    }

    const parser = new Parser(tokens);
    const expr = parser.parseExpr();
    if (parser.hasMore()) {
      return fail("Unexpected trailing input.");
    }
    return ok(expr);
  } catch (err) {
    return fail(err instanceof ParseError ? err.message : "Could not parse expression.", err);
  }
}

function evaluateExpr(node: PlantNode, expr: FilterExpr): boolean {
  if (expr.kind === "and") {
    return evaluateExpr(node, expr.left) && evaluateExpr(node, expr.right);
  }
  if (expr.kind === "or") {
    return evaluateExpr(node, expr.left) || evaluateExpr(node, expr.right);
  }
  return matchesCondition(node, expr);
}

/**
 * Renders a simple-mode condition list as its advanced-syntax equivalent
 * (seeds the switch to advanced mode). "Does not contain" has no dedicated
 * advanced keyword — it's `!=` with the value wrapped in wildcards, which the
 * glob-aware `!=` evaluates identically.
 */
export function conditionsToExpression(conditions: readonly CustomFilterCondition[]): string {
  const quote = (value: string): string => (value.includes("'") ? `"${value}"` : `'${value}'`);
  return conditions
    .filter((c) => c.value.trim().length > 0)
    .map((c) => {
      const fieldToken =
        c.field === "type"
          ? "TYPE"
          : c.field === "id"
            ? "ID"
            : c.field === "xpath"
              ? "XPATH"
              : c.field === "persistentId"
                ? "PERSISTENT_ID"
                : `ATTR(${quote(c.attributeName)})`;
      if (c.operator === "contains") {
        return `${fieldToken} CONTAINS ${quote(c.value)}`;
      }
      if (c.operator === "notContains") {
        return `${fieldToken} != ${quote(`*${c.value}*`)}`;
      }
      const opToken = c.operator === "notEquals" ? "!=" : "=";
      return `${fieldToken} ${opToken} ${quote(c.value)}`;
    })
    .join(" & ");
}

// -----------------------------------------------------------------------------
// Matching across the document
// -----------------------------------------------------------------------------

/** Whether a filter would do anything if applied — used to skip empty/disabled filters. */
export function isFilterActive(filter: CustomHighlightFilter): boolean {
  if (!filter.enabled) {
    return false;
  }
  return filter.advanced
    ? filter.expression.trim().length > 0
    : filter.conditions.some((c) => c.value.trim().length > 0);
}

function compileFilter(filter: CustomHighlightFilter): Result<(node: PlantNode) => boolean> {
  if (!filter.advanced) {
    return ok((node) => matchesConditions(node, filter.conditions));
  }

  const parsed = parseFilterExpression(filter.expression);
  if (!parsed.data) {
    return fail(parsed.error?.msg ?? "Could not parse expression.", parsed.error?.err);
  }

  const expr = parsed.data;
  return ok((node) => evaluateExpr(node, expr));
}

/**
 * Object ids matched by each active filter — one entry per filter, in list
 * order. Callers apply colors by walking this in order and overwriting a
 * shared id→color map, so a later filter's color wins where objects match
 * more than one (the same order the editor lets you set). An advanced
 * filter whose expression fails to parse matches nothing and carries `error`
 * instead, for the editor to surface inline.
 */
export function matchCustomFilters(
  nodes: Iterable<PlantNode>,
  filters: readonly CustomHighlightFilter[],
): readonly CustomFilterMatch[] {
  const active = filters.filter(isFilterActive);
  if (active.length === 0) {
    return [];
  }

  const compiled = active.map((filter) => ({ filter, result: compileFilter(filter) }));
  const matches = new Map<string, string[]>(active.map((f) => [f.id, []]));
  for (const node of nodes) {
    for (const { filter, result } of compiled) {
      if (result.data?.(node) === true) {
        matches.get(filter.id)?.push(node.id);
      }
    }
  }

  return compiled.map(({ filter, result }) => ({
    filterId: filter.id,
    objectIds: matches.get(filter.id) ?? [],
    error: result.error?.msg,
  }));
}

/** Count of objects matched by two or more active filters — the overlap warning. */
export function countCustomFilterOverlaps(matches: readonly CustomFilterMatch[]): number {
  const counts = new Map<string, number>();
  for (const match of matches) {
    for (const id of match.objectIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  let overlapping = 0;
  for (const count of counts.values()) {
    if (count > 1) {
      overlapping += 1;
    }
  }
  return overlapping;
}
