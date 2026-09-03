// -----------------------------------------------------------------------------
// Minimal ZIP writer
//
// Stored (uncompressed) entries only — that is all an .xlsx needs (the OOXML
// parts of a validation report are tens of KB), and it keeps the app free of
// a zip/spreadsheet dependency: nothing to vet against the AGPL, nothing to
// add to the third-party notices, nothing extra in the bundle. Entry
// timestamps are fixed so the same report always produces the same bytes.
// -----------------------------------------------------------------------------

export type ZipEntry = Readonly<{
  /** Path inside the archive, "/"-separated, no leading slash. */
  path: string;
  /** Entry content; encoded as UTF-8. */
  text: string;
}>;

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIR_SIZE = 22;
const VERSION_NEEDED = 20;
/** Bit 11 — file names (and comments) are UTF-8. */
const FLAG_UTF8_NAMES = 0x0800;
const METHOD_STORED = 0;
/** 1980-01-01 00:00 in MS-DOS date/time, the epoch of the ZIP format. */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let byte = 0; byte < 256; byte += 1) {
    let value = byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[byte] = value >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

type PreparedEntry = Readonly<{
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}>;

function localHeader(entry: PreparedEntry): Uint8Array {
  const header = new Uint8Array(LOCAL_HEADER_SIZE + entry.name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, LOCAL_HEADER_SIGNATURE, true);
  view.setUint16(4, VERSION_NEEDED, true);
  view.setUint16(6, FLAG_UTF8_NAMES, true);
  view.setUint16(8, METHOD_STORED, true);
  view.setUint16(10, DOS_TIME, true);
  view.setUint16(12, DOS_DATE, true);
  view.setUint32(14, entry.crc, true);
  view.setUint32(18, entry.data.length, true);
  view.setUint32(22, entry.data.length, true);
  view.setUint16(26, entry.name.length, true);
  view.setUint16(28, 0, true);
  header.set(entry.name, LOCAL_HEADER_SIZE);
  return header;
}

function centralHeader(entry: PreparedEntry): Uint8Array {
  const header = new Uint8Array(CENTRAL_HEADER_SIZE + entry.name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, CENTRAL_HEADER_SIGNATURE, true);
  view.setUint16(4, VERSION_NEEDED, true);
  view.setUint16(6, VERSION_NEEDED, true);
  view.setUint16(8, FLAG_UTF8_NAMES, true);
  view.setUint16(10, METHOD_STORED, true);
  view.setUint16(12, DOS_TIME, true);
  view.setUint16(14, DOS_DATE, true);
  view.setUint32(16, entry.crc, true);
  view.setUint32(20, entry.data.length, true);
  view.setUint32(24, entry.data.length, true);
  view.setUint16(28, entry.name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, entry.offset, true);
  header.set(entry.name, CENTRAL_HEADER_SIZE);
  return header;
}

function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array {
  const record = new Uint8Array(END_OF_CENTRAL_DIR_SIZE);
  const view = new DataView(record.buffer);
  view.setUint32(0, END_OF_CENTRAL_DIR_SIGNATURE, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  view.setUint16(20, 0, true);
  return record;
}

/**
 * Packs `entries` into a ZIP archive, in the order given (an .xlsx reader
 * expects `[Content_Types].xml` first). Every entry is stored uncompressed,
 * which is a valid ZIP that Excel, Windows Explorer and any unzip tool read.
 *
 * The bytes are `ArrayBuffer`-backed, so they hand straight to `Blob`.
 */
export function createZip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const body: Uint8Array[] = [];
  const prepared: PreparedEntry[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = encoder.encode(entry.text);
    const item: PreparedEntry = { name, data, crc: crc32(data), offset };
    const header = localHeader(item);
    body.push(header, data);
    prepared.push(item);
    offset += header.length + data.length;
  }

  const directory = prepared.map(centralHeader);
  const directorySize = directory.reduce((sum, chunk) => sum + chunk.length, 0);
  return concat([...body, ...directory, endOfCentralDirectory(prepared.length, directorySize, offset)]);
}
