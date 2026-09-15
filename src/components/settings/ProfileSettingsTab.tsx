import { Checkbox } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { PRE_STAMP_VERSION } from "../../lib/dexpi/profileVersion.ts";
import { activeProfileLabel, profileState } from "../../state/profile/profile.state.ts";
import { setProfileAutoLoad } from "../../state/viewer/viewer.actions.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const AUTO_LOAD_INFO =
  "DiscProfile 0.6.4 is the first release to stamp its version, and drawings written against it import the versioned URI. " +
  `With this on, opening such a drawing loads the matching bundled catalogue; a drawing importing the older unversioned URI loads ${PRE_STAMP_VERSION}. ` +
  "Picking a catalogue by hand in the ribbon pins it and switches this off for that choice — press Auto in the ribbon to hand control back. " +
  "A declared version the app does not bundle is never substituted; Validation reports it as META-003 instead.";

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function describeDeclared(declaredVersion: string | null): string {
  return declaredVersion === null
    ? "The open document imports no DISC profile."
    : `The open document declares DiscProfile ${declaredVersion}.`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** DISC catalogue settings: the autoload opt-in plus what is active right now. */
export function ProfileSettingsTab(): JSX.Element {
  const { active, isPinned, autoLoad, declaredVersion } = profileState.use();

  const activeLabel = activeProfileLabel(active);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <Checkbox
        checked={autoLoad}
        onChange={(on) => void setProfileAutoLoad(on)}
        label="Auto-load the declared profile"
        hint="Follow the document's DiscProfile import"
        info={AUTO_LOAD_INFO}
      />
      <div className="flex flex-col gap-1 text-slate-400 text-xs">
        <div>{describeDeclared(declaredVersion)}</div>
        <div>
          {activeLabel === null
            ? "No catalogue is loaded — profile symbols will not resolve."
            : `Active: ${activeLabel}${isPinned ? " (pinned by hand)" : ""}.`}
        </div>
      </div>
    </div>
  );
}
