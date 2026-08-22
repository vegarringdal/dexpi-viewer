import { initTooltips } from "@tredespace/ui/widgets";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { registerAppHotkeys } from "./components/hotkeys.ts";
import { applyStoredRenderingSettings } from "./state/rendering/rendering.actions.ts";
import { applyStoredTheme } from "./state/theme/theme.actions.ts";
import { applyStoredValidationOverrides } from "./state/validation/validation.actions.ts";
import "./index.css";

// "?docs" on the app URL jumps straight to the bundled manual (linkable).
if (new URLSearchParams(window.location.search).has("docs")) {
  window.location.replace("manual/index.html");
}

applyStoredTheme();
applyStoredRenderingSettings();
applyStoredValidationOverrides();
initTooltips();
registerAppHotkeys();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
