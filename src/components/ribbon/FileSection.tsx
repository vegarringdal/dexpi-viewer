import { IconFileTypeXml, IconFolderOpen } from "@tabler/icons-react";
import { RibbonButton, RibbonSection, useFilePicker } from "@tredespace/ui/widgets";
import { type JSX, useEffect } from "react";
import { openDocumentFile, openExampleDocument } from "../../state/viewer/viewer.actions.ts";
import { setOpenFileTrigger } from "../hotkeys.ts";

/** Open / Example buttons plus the document file picker. */
export function FileSection(): JSX.Element {
  const picker = useFilePicker(".xml", (file) => {
    void openDocumentFile(file);
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
      </RibbonSection>
      {picker.element}
    </>
  );
}
