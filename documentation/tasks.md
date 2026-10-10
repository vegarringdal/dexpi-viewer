# Common tasks

Short recipes for the things people open the viewer for. Each links to the page with the details.

## Check a file someone sent you

<!-- steps -->
1. Press **Open** and choose the `.xml` file, or drop it on the window. → [Getting started](getting-started.md#open-a-file)
2. Check the status bar. An **amber** profile means the wrong DISC catalogue is loaded; pick the version the document declares in ribbon → Profile.
3. Read the **Validation** tab. Start with **Errors**, then Warnings. → [Validation](validation.md#work-through-the-findings)
4. Press **Excel** in the Validation panel to send the findings back. Each row has the source line and XPath, so the author can find it in their XML editor.

## Find out why an object fails validation

<!-- steps -->
1. In Validation, click the finding's `↳` object link. The drawing zooms to it.
2. Look at **Properties → Issues** for every finding on that object. → [Properties](explorer.md#properties)
3. Expand **Inspect**. Red rows mark missing or invalid properties; a red broken card is a reference to something that does not exist. → [Inspect](inspect.md#reading-the-diagram)
4. Need the raw data? Right-click the card → **Copy data as JSON**, or **Copy XPath** to locate it with `xmllint`.

## Verify a drawing against the official rendering

<!-- steps -->
1. Open the DEXPI file, then **Underlay…** above the drawing and choose the reference SVG, PDF or image.
2. Tick **Hide white** and **Tint**. The reference ink turns red under the black drawing.
3. Zoom around: red-only means missing from the drawing, black-only means extra. → [Compare against a reference rendering](viewing.md#compare-against-a-reference-rendering)

## Follow a line through the plant

<!-- steps -->
1. Select a pump, valve or pipe.
2. In **Connections**, press **Upstream**, **Downstream** or **Both**. The run lights up amber / green in the drawing. → [Trace a line](topology.md#trace-a-line)
3. Click the next object to move the trace along. Click the active button again to clear it.
4. For the bigger picture, expand the **Topology graph** and raise **Depth**. → [Topology graph](topology.md#topology-graph)

## Show everything with a given property

<!-- steps -->
1. Open **Highlight** and set **Highlight by** to Fluid code, Piping class, Heat traced or Signal & instrument lines.
2. Turn on **Black & white drawing** and **Dim drawing** so the colours stand out.
3. For anything else, choose **Custom** and add a filter, e.g. *Attribute* `FluidCode` *Equals* `A*`. → [Custom filters](highlight.md#custom-filters)
4. Export it with **As viewed → PDF**. → [Exports](export.md#make-a-marked-up-pdf)

## Find one object by tag

<!-- steps -->
1. In the **Explorer**, type part of the tag into **Search**.
2. Click the row, then **Zoom to**. → [Explorer](explorer.md#find-an-object)

## Silence a rule you don't care about

<!-- steps -->
1. In Validation, press the sliders button to open **Rule severities**.
2. Set the rule to **Ignore** — or to Info, to keep it but out of the way. → [Change a rule's severity](validation.md#change-a-rules-severity)
3. The choice is remembered and applies to the reports too.
