import { describe, expect, it } from "vitest";
import { createZip } from "./zip.ts";

// -----------------------------------------------------------------------------
// createZip — the archives are read back here with a minimal stored-entry
// reader (central directory → local header → data), which is what an unzip
// tool does. The CRCs are checked against independently known values, so a
// broken checksum can't pass just because the reader shares the writer's bug.
// -----------------------------------------------------------------------------

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIR_SIZE = 22;
/** zlib's crc32("hello") — the canonical published value. */
const CRC32_OF_HELLO = 0x3610a686;

type ReadEntry = Readonly<{ path: string; text: string; crc: number }>;

function readStoredZip(bytes: Uint8Array): readonly ReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const eocd = bytes.length - END_OF_CENTRAL_DIR_SIZE;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);

  const entries: ReadEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const path = decoder.decode(
      bytes.subarray(at + CENTRAL_HEADER_SIZE, at + CENTRAL_HEADER_SIZE + nameLength),
    );

    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(offset + 26, true);
    const dataAt = offset + LOCAL_HEADER_SIZE + localNameLength;
    entries.push({ path, crc, text: decoder.decode(bytes.subarray(dataAt, dataAt + size)) });
    at += CENTRAL_HEADER_SIZE + nameLength;
  }
  return entries;
}

describe("createZip", () => {
  it("round-trips entries in order, with correct checksums", () => {
    const archive = createZip([
      { path: "hello.txt", text: "hello" },
      { path: "nested/second.xml", text: "<a>second</a>" },
    ]);

    expect(archive.subarray(0, 4)).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    const entries = readStoredZip(archive);
    expect(entries.map((e) => e.path)).toEqual(["hello.txt", "nested/second.xml"]);
    expect(entries.map((e) => e.text)).toEqual(["hello", "<a>second</a>"]);
    expect(entries[0]?.crc).toBe(CRC32_OF_HELLO);
  });

  it("stores UTF-8 content and names byte-for-byte", () => {
    const entries = readStoredZip(createZip([{ path: "unité.txt", text: "grå rør — 20 °C" }]));
    expect(entries[0]?.path).toBe("unité.txt");
    expect(entries[0]?.text).toBe("grå rør — 20 °C");
  });

  it("produces the same bytes for the same input (fixed entry timestamps)", () => {
    const entries = [{ path: "a.txt", text: "a" }];
    expect(createZip(entries)).toEqual(createZip(entries));
  });

  it("writes a readable, empty archive for no entries", () => {
    const archive = createZip([]);
    expect(archive.length).toBe(END_OF_CENTRAL_DIR_SIZE);
    expect(readStoredZip(archive)).toEqual([]);
  });
});
