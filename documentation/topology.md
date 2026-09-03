# Topology & highlighting

## Topology graph

![The semantic topology graph; the highlighted toolbar picks the mode, depth, edge kinds and node kinds](images/topology.png)

The engineering data as a semantic network: plant objects as category-colored nodes with **flow**, **containment** and **reference** edges, laid out along the flow direction. Neighborhood mode graphs the current selection with an adjustable hop depth; Document mode graphs the whole file. Connection hardware (nozzles, chambers, piping nodes, ports) collapses into its owner or shows as mini nodes. Nodes sync with the global selection; double-click zooms the drawing.

## Connections & tracing

The Connections panel lists the selected object's flow neighbours and traces **upstream** (amber) / **downstream** (green) through the piping — the trace tints the drawing and recirculation loops are called out.

## Highlight

![Signal highlighting per type, black & white drawing, dim others](images/highlight-dim.png)

The Highlight panel tints the drawing by classification — heat-traced runs, signal/instrument lines, fluid code or piping class (with ancestor inheritance) — each value in its own color with a legend of counts and per-value visibility toggles. Signal mode groups **per signal semantics** (electrical, bus, measuring, …), so each type highlights in its own color. A **Black & white drawing** toggle (also the big **B/W** button in ribbon → View, which shows when it is on) renders the file's content in ink only, so highlight tints never mix with the drawing's own colors, and **Dim others** fades everything outside the highlighted groups so the tints stand out; the palette deliberately contains no blue — blue always means selection.

### Custom filters

For anything the four built-in classifications don't cover, pick **Custom**. Each filter is one or more conditions on an object's **Type**, a named **Attribute**, its **ID**, its **XPath**, or a **Persistent ID**, matched with **Contains** / **Does not contain** / **Equals** / **Does not equal** (case-insensitive). Equals and Does not equal treat `*` as a wildcard, so on XPath a value like `/Model/Object[2]*` matches that object **and every descendant** — an XPath is a path from the root, so a child's path always starts with its parent's.

Multiple conditions in one filter combine with AND. Flip a filter to **Advanced** to write your own `&` (and) / `|` (or) / `()` expression instead, e.g.:

```
TYPE = 'Piping.BallValve' & (ATTR('FluidCode') = 'A*' | ATTR('FluidCode') != 'B*')
```

Filters apply top-to-bottom, each with its own color; where two filters match the same object, **the lower one in the list wins** — reorder with the up/down arrows, and a warning banner reports how many objects overlap so an unintended one doesn't go unnoticed. Save the current filter set to a JSON file with **Save**, and bring it back later (or on another document) with **Load**.

## Semantic signal-line styling

Signal lines render by their semantics, matching the official DISC renderings: measuring and hydraulic lines solid, plain signal lines dashed, electrical lines solid with bracket marks, bus lines dashed with circle marks.
