import { type LabelInspectPlacement, labelInspectState } from "./labelInspect.state.ts";

export function setLabelInspectEnabled(enabled: boolean): void {
  labelInspectState.set({ enabled });
}

export function setLabelInspectColor(colorHex: string): void {
  labelInspectState.set({ colorHex });
}

export function setLabelInspectOpacity(opacityPercent: number): void {
  labelInspectState.set({ opacityPercent: Math.min(100, Math.max(0, opacityPercent)) });
}

export function setLabelInspectPlacement(placement: LabelInspectPlacement): void {
  labelInspectState.set({ placement });
}
