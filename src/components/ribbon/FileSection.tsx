import { IconFileTypeXml, IconFolderOpen, IconPuzzle, IconPuzzleFilled } from "@tabler/icons-react";
import { RibbonButton, RibbonSection, useFilePicker } from "@tredespace/ui/widgets";
import { type JSX, useEffect } from "react";
import {
  BUNDLED_PROFILE_NAME,
  openBundledProfile,
  openDocumentFile,
  openExampleDocument,
  openProfileFile,
} from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { setOpenFileTrigger } from "../hotkeys.ts";

/** Open / Example / Profile buttons plus their hidden file pickers. */
export function FileSection(): JSX.Element {
  const { profileName } = viewerState.use();

  const picker = useFilePicker(".xml", (file) => {
    void openDocumentFile(file);
  });

  const profilePicker = useFilePicker(".xml", (file) => {
    void openProfileFile(file);
  });

  const handleOpenExample = (): void => {
    void openExampleDocument();
  };

  // The global "open file" hotkey triggers this picker.
  useEffect(() => {
    setOpenFileTrigger(picker.open);
    return () => setOpenFileTrigger(null);
  }, [picker.open]);

  return (
    <>
      <RibbonSection title="File">
        <RibbonButton
          icon={<IconFolderOpen />}
          label="Open"
          size="big"
          tooltip={"Open a DEXPI 2.0 XML file\nDrag & drop works too"}
          shortcut="file.open"
          onClick={picker.open}
        />
        <RibbonButton
          icon={<IconFileTypeXml />}
          label="Example"
          size="big"
          tooltip={"Load the bundled example P&ID\n(DISC_EXAMPLE-14 sheet 13 — pairs with Profile 0.6.3)"}
          shortcut="file.example"
          onClick={handleOpenExample}
        />
        <RibbonButton
          icon={<IconPuzzleFilled />}
          label="Profile 0.6.3"
          size="big"
          selected={profileName === BUNDLED_PROFILE_NAME}
          tooltip={
            "Use the bundled official DISC Profile 0.6.3 catalogue\n(284 symbols, from the DISC DEXPI 2026 Pack)\nSymbols apply to the current and future documents"
          }
          shortcut="file.profile063"
          onClick={() => void openBundledProfile()}
        />
        <RibbonButton
          icon={<IconPuzzle />}
          label="Custom profile"
          size="big"
          selected={profileName !== null && profileName !== BUNDLED_PROFILE_NAME}
          tooltip={
            "Load your own DISC profile (DiscProfile.xml)\nSymbols apply to the current and future documents\nReplaces the bundled 0.6.3 profile if one is active"
          }
          onClick={profilePicker.open}
        />
      </RibbonSection>
      {picker.element}
      {profilePicker.element}
    </>
  );
}
