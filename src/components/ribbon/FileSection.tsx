import { IconFileTypeXml, IconFolderOpen, IconPuzzle } from "@tabler/icons-react";
import { RibbonButton, RibbonSection, useFilePicker } from "@tredespace/ui/widgets";
import { type JSX, useEffect } from "react";
import { openDocumentFile, openExampleDocument, openProfileFile } from "../../state/viewer/viewer.actions.ts";
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
          tooltip="Load the bundled DEXPI example P&ID"
          shortcut="file.example"
          onClick={handleOpenExample}
        />
        <RibbonButton
          icon={<IconPuzzle />}
          label="Profile"
          size="big"
          selected={profileName !== null}
          tooltip={
            "Load a DISC profile (DiscProfile.xml, DEXPI 2.1)\nSymbols apply to the current and future documents\nNote: the DISC profile spec isn't publicly available — support is best-effort and may be buggy"
          }
          onClick={profilePicker.open}
        />
      </RibbonSection>
      {picker.element}
      {profilePicker.element}
    </>
  );
}
