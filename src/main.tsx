import { initTooltips } from "@tredespace/ui/widgets";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { registerAppHotkeys } from "./components/hotkeys.ts";
import { applyStoredRenderingSettings } from "./state/rendering/rendering.actions.ts";
import { applyStoredTheme } from "./state/theme/theme.actions.ts";
import "./index.css";

applyStoredTheme();
applyStoredRenderingSettings();
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
