// Minimaler ZIP-Packer ohne Abhängigkeiten (nur "stored", keine Kompression) –
// reicht für Backups aus vielen kleinen JSON-Dateien.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Datum/Uhrzeit im DOS-Format, wie ZIP es erwartet. */
function dosDateTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Packt Dateien in ein ZIP.
 * @param {{name: string, content: string}[]} files  name darf Ordner enthalten ("Pokemon/x.json")
 * @returns {Blob}
 */
export function createZip(files, now = new Date()) {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const parts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.name);
    const data = enc.encode(file.content);
    const crc = crc32(data);

    // Gemeinsamer Teil von Local Header und Central Directory; Bit 11 = Dateinamen in UTF-8
    const common = (v, at) => {
      v.setUint16(at, 20, true); // benötigte Version
      v.setUint16(at + 2, 0x0800, true);
      v.setUint16(at + 4, 0, true); // stored
      v.setUint16(at + 6, time, true);
      v.setUint16(at + 8, date, true);
      v.setUint32(at + 10, crc, true);
      v.setUint32(at + 14, data.length, true);
      v.setUint32(at + 18, data.length, true);
      v.setUint16(at + 22, name.length, true);
    };

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    common(local, 4);
    parts.push(local, name, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true); // erstellt mit Version
    common(cd, 6);
    cd.setUint32(42, offset, true);
    central.push(cd, name);

    offset += 30 + name.length + data.length;
  }

  const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
