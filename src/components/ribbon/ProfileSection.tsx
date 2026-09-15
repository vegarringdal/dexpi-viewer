import { IconPuzzle, IconPuzzleFilled, IconWand } from "@tabler/icons-react";
import { RibbonButton, RibbonSection, useFilePicker } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { BUNDLED_PROFILE_VERSIONS, LATEST_BUNDLED_PROFILE } from "../../lib/dexpi/profileVersion.ts";
import { profileState } from "../../state/profile/profile.state.ts";
import {
  followDeclaredProfile,
  openProfileFile,
  selectBundledProfile,
} from "../../state/viewer/viewer.actions.ts";

// -----------------------------------------------------------------------------
// Tooltips
// -----------------------------------------------------------------------------

const AUTO_TOOLTIP_ON =
  "Follow the DiscProfile version the open document imports\nUnversioned imports (pre-0.6.4) load 0.6.3";
const AUTO_TOOLTIP_OFF = "Auto-loading is off\nTurn it on in Settings → Profile";
const CUSTOM_TOOLTIP =
  "Load your own DISC profile (DiscProfile.xml)\nSymbols apply to the current and future documents\nReplaces the bundled catalogue if one is active";

/** What a bundled version's button says it does. */
function versionTooltip(version: string): string {
  return `Use the bundled official DISC Profile ${version} catalogue\n(from the DISC DEXPI 2026 Pack)\nSymbols apply to the current and future documents`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Catalogue picker: auto / a bundled version / a custom DiscProfile.xml.
 * Auto and a version button can light at once — Auto is the mode, the lit
 * version is what that mode resolved the open document to.
 */
export function ProfileSection(): JSX.Element {
  const { active, isPinned, autoLoad, declaredVersion } = profileState.use();

  const profilePicker = useFilePicker(".xml", (file) => {
    void openProfileFile(file);
  });

  const autoHint = declaredVersion ? `\nThis document declares ${declaredVersion}` : "";

  return (
    <>
      <RibbonSection title="Profile">
        <RibbonButton
          icon={<IconWand />}
          label="Auto"
          size="mini"
          selected={!isPinned && autoLoad}
          disabled={!autoLoad}
          tooltip={(autoLoad ? AUTO_TOOLTIP_ON : AUTO_TOOLTIP_OFF) + autoHint}
          onClick={() => void followDeclaredProfile()}
        />
        {BUNDLED_PROFILE_VERSIONS.map((version) => (
          <RibbonButton
            key={version}
            icon={<IconPuzzleFilled />}
            label={version}
            size="mini"
            selected={active.kind === "bundled" && active.version === version}
            tooltip={versionTooltip(version)}
            {...(version === LATEST_BUNDLED_PROFILE ? { shortcut: "file.profileLatest" } : {})}
            onClick={() => void selectBundledProfile(version)}
          />
        ))}
        <RibbonButton
          icon={<IconPuzzle />}
          label="Custom profile"
          size="big"
          selected={active.kind === "custom"}
          tooltip={CUSTOM_TOOLTIP}
          onClick={profilePicker.open}
        />
      </RibbonSection>
      {profilePicker.element}
    </>
  );
}
