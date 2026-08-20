/** Hands the browser a file to save. */
export function downloadBlob(data: BlobPart, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
