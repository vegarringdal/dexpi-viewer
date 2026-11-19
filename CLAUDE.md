# Project context for Claude

* always lint code - biome
* always typecheck code
* read specs - dont assmue
* keep readme.md up to date
* app to by typescript/tsx(react) for gui and skia canvas kit for drawing.
* read DESIGN.md for more info, and keep it up to date
* CHANGELOG.md — add an entry for EVERY change. The version in package.json (never bump it yourself) is bumped by the director at release time; between bumps, each piece of work gets a bullet under a date heading so the diff between two versions reads as prose, not commits. Append at the TOP of the file:

```
- **YYYY.MM.DD** (>PACKAGEVERSION):
  - **Short title** — what changed and why, and who or what triggered it
    (director's ask, a bug report, a screenshot, a new spec/profile release).
    - What was done: the behaviour or rule now in force, with the key files,
      functions and constants named so the code can be found.
    - Root cause, for a fix: what was wrong and how it was found.
    - Decisions and rejected alternatives, with the reason.
    - Verification: tests added or updated, checks against official data or
      renderings, counts that pin it.
    - Known gaps or deferred work: also add these to OPEN_ITEMS.md.
    - Corrections to an earlier entry: name it ("supersedes 2026.09.03 …").
```
  Write for someone reading the diff between two releases — informative prose, not commit messages. Use as many detail bullets as the change needs; a one-line fix can stay one line. Leave out bullets that don't apply.
  PACKAGEVERSION is the version currently in package.json (the entry is "after" that release). Several changes on one day share the date heading as separate title bullets. Write it in the same pass as the code. Read package.json and today's date at the moment you write the entry — the version is bumped often, so never copy the heading of the entry above: reuse an existing heading only when BOTH its date and its version still match; otherwise start a new heading on top.
  History belongs here, not in DESIGN.md: DESIGN.md keeps only the current rule, edited in place when it changes.


## Working style

The director decides, Claude implements and pushes back when it disagrees. Show
a plan before multi-file changes. Never push, never destroy git history; the
director owns merges and pushes.


# React & TypeScript Style Guide

## General Rules
- Prefer functional components with named exports (no default exports).
- Explicitly type all props, function parameters, and return types.
- Never use `any`.
- Avoid `as` type assertions. Prefer proper typing, type guards, `unknown`, or `satisfies`.
- Use `as` only when no safe alternative exists, and keep assertions as narrow as possible.
- Prefer type aliases for unions and mapped types.
- Avoid enums; prefer string literal unions.
- Use readonly where appropriate.
- Narrow unknown values with type guards.

## Component Architecture
- Keep component files under ~120 lines.
  - Exceed this limit only when splitting the component would reduce readability or cohesion.
- Extract complex UI state or data fetching into custom hooks.
- Use Discriminated Unions for multi-step or conditional UI states.
- Follow SRP (Single Responsibility Principle): one component per file.
- Components must focus on rendering.
- Business logic should live in hooks or services.
- Avoid prop drilling beyond two levels.
- Custom hooks should return an object instead of arrays unless order matters.
- Use logical section headers for larger components, no not use /*xyz*/
```

  // -----------------------------------------------------------------------------
  // section name
  // -----------------------------------------------------------------------------

  code...

      // -----------------------------------------------------------------------------
  // section name
  // -----------------------------------------------------------------------------

  code...


 // with this order:
  1. Types
  2. Constants
  3. Hooks
  4. Derived state
  5. Helper functions
  6. Event handlers
  7. Effects
  8. Render

```

## State placement — `*.state.ts` / `*.actions.ts`

Shared state is a tiny `createStore` (`@treDeSpaceUI/lib/createStore`,
`useSyncExternalStore` under the hood). Each domain splits in two files:

- `<name>.state.ts` — the store and its state type only. Keep it
  JSON-serializable; live callbacks/resolvers belong in the actions module.
- `<name>.actions.ts` — **all** mutation, plus any non-serializable handles.
  Components call actions; they never call `store.set()` themselves.

Where the pair lives depends on who reads it:

- **Only one component/panel uses it** → keep it next to the `.tsx`, e.g.
  `src/components/dialogs/dialogs.state.ts` + `dialogs.actions.ts`.
- **Anything outside that folder needs it** (another panel, a hotkey, the
  postMessage API, a worker) → move it to `src/state/`, one folder per domain
  (`src/state/viewer/viewer.state.ts` + `viewer.actions.ts`).

Move the pair to `src/state/` at the moment the second consumer appears — don't
pre-place it there "just in case", and don't reach up into another component
folder's state file instead of moving it.

Not everything needs a store: state used by a single component stays in
`useState`/a custom hook. Reach for a store when the state outlives the
component, must be read outside React, or has more than one reader.

Persist to `localStorage` only where it matters, and do it in the actions
module.

## JSX & Code Cleanliness
- Use early returns instead of deeply nested ternaries or conditional blocks.
- Extract inline handlers if they exceed 2 lines of code.
- Prefer explicit props destructuring.

## Control Flow Formatting:
 - Always use explicit block statements (curly braces) for all `if` statements, 
even for single-line early returns. Do not write single-line `if (condition) return ...` without braces.

## Complex logic
When a function contains a non-obvious algorithm, add a short JSDoc comment
describing the intent and constraints before the function.

Avoid inline comments inside the algorithm unless a specific step is
surprising or non-obvious.

## Documentation
- Document exported functions, hooks, components, and complex algorithms with JSDoc.
- Do not document obvious code.
- Explain intent, assumptions, or constraints—not obvious implementation details.
- Keep comments up to date with the implementation.
- Remove commented-out code instead of leaving it in the file.



## Formatting
- Separate logical sections with one blank line.
- Avoid multiple consecutive blank lines.
- Keep related statements together.
- Insert a blank line after early returns.


## Reusability

- Avoid duplicated logic.
- Extract repeated logic into hooks, utilities, or shared components.
- Prefer composition over duplication.

## Constants

- Replace magic numbers and strings with named constants when reused or non-obvious.
Instead of
 `setTimeout(..., 250);`
prefer
`const SEARCH_DEBOUNCE_MS = 250;

## Naming
- Components: PascalCase
- Hooks: use*
- Utilities: camelCase
- Event handlers: handle*
- Helper functions: verb*
- Types: PascalCase
- Interfaces: PascalCase
- Constants: UPPER_SNAKE_CASE only for true constants
- Boolean variables should read naturally:
  - isLoading
  - hasChildren
  - canEdit
  - shouldRefresh


## Async & Error Handling

- Async functions must never throw expected application errors.
- Instead, return a `Result<T>` object.
- Only unrecoverable programming errors (e.g. invariant violations or impossible states) may throw.
- Always handle both the success and error cases explicitly.

```ts
type ErrorResult = Readonly<{
  err: unknown;
  msg: string;
}>;

type Result<T> = Readonly<{
  data?: T;
  error?: ErrorResult;
}>;
```

Example:

```ts
const result = await userService.load(id);

if (result.error) {
  toast.error(result.error.msg);
  return;
}

const user = result.data;
```