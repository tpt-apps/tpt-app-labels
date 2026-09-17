// Minimal, dependency-free ZIP writer (STORE method, no compression).
// Good enough for bundling a handful of small SVG/PNG label files client-side
// without pulling in a third-party library that would need its own offline
// caching story.

function crc32(bytes) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const day =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { time, day };
}

function u16(v) { return [v & 0xff, (v >> 8) & 0xff]; }
function u32(v) { return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]; }

/**
 * @param {{name: string, data: Uint8Array}[]} files
 * @returns {Blob} a `application/zip` blob (STORE / no compression)
 */
export function createZip(files) {
  const { time, day } = dosDateTime(new Date());
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);

    const localHeader = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, // local file header signature
      20, 0,                   // version needed
      0, 0,                    // flags
      0, 0,                    // compression: store
      ...u16(time), ...u16(day),
      ...u32(crc),
      ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), 0, 0,
    ]);

    chunks.push(localHeader, nameBytes, data);

    central.push({
      nameBytes,
      crc,
      size: data.length,
      offset,
      time,
      day,
    });

    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  const centralChunks = [];
  for (const e of central) {
    const header = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, // central directory header signature
      20, 0, 20, 0,
      0, 0,
      0, 0,
      ...u16(e.time), ...u16(e.day),
      ...u32(e.crc),
      ...u32(e.size), ...u32(e.size),
      ...u16(e.nameBytes.length), 0, 0, 0, 0,
      0, 0,
      0, 0, 0, 0,
      ...u32(e.offset),
    ]);
    centralChunks.push(header, e.nameBytes);
    offset += header.length + e.nameBytes.length;
  }
  const centralSize = offset - centralStart;

  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    0, 0, 0, 0,
    ...u16(central.length), ...u16(central.length),
    ...u32(centralSize),
    ...u32(centralStart),
    0, 0,
  ]);

  return new Blob([...chunks, ...centralChunks, end], { type: "application/zip" });
}
