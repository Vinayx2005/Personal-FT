// MIME sniffing from file bytes. Google Drive sometimes returns
// application/octet-stream on download, so we can't trust the response's
// Content-Type. Reading the first few bytes gives us the truth for the
// common formats we see in receipts (PDFs, phone-camera images, docs).

export interface SniffedMime {
  contentType: string;
  extension: string;
}

const UNKNOWN: SniffedMime = { contentType: 'application/octet-stream', extension: 'bin' };

// Match a prefix (any position of `null` in `sig` means "any byte").
const matches = (bytes: Uint8Array, offset: number, sig: (number | null)[]): boolean => {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    const expected = sig[i];
    if (expected === null) continue;
    if (bytes[offset + i] !== expected) return false;
  }
  return true;
};

export const sniffMime = (bytes: Uint8Array): SniffedMime => {
  if (!bytes || bytes.length < 4) return UNKNOWN;

  // PDF: "%PDF-"
  if (matches(bytes, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { contentType: 'application/pdf', extension: 'pdf' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: 'image/png', extension: 'png' };
  }
  // JPEG: FF D8 FF
  if (matches(bytes, 0, [0xff, 0xd8, 0xff])) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  // GIF: "GIF87a" or "GIF89a"
  if (matches(bytes, 0, [0x47, 0x49, 0x46, 0x38])) {
    return { contentType: 'image/gif', extension: 'gif' };
  }
  // WebP: RIFF....WEBP
  if (matches(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  // HEIC: bytes 4..8 == "ftyp" then heic/heix/mif1
  if (matches(bytes, 4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (['heic', 'heix', 'mif1', 'msf1', 'heif'].includes(brand)) {
      return { contentType: 'image/heic', extension: 'heic' };
    }
    if (brand.startsWith('mp4') || brand === 'isom' || brand === 'M4V ' || brand === 'M4A ') {
      return { contentType: 'video/mp4', extension: 'mp4' };
    }
  }
  // BMP: "BM"
  if (matches(bytes, 0, [0x42, 0x4d])) {
    return { contentType: 'image/bmp', extension: 'bmp' };
  }
  // TIFF: "II*\0" or "MM\0*"
  if (matches(bytes, 0, [0x49, 0x49, 0x2a, 0x00]) || matches(bytes, 0, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { contentType: 'image/tiff', extension: 'tiff' };
  }
  // ZIP-based Office (docx/xlsx/pptx): PK\x03\x04, then peek at central directory
  // for the type marker. Cheap-and-cheerful: just return application/zip and let
  // the extension differentiate. We only handle the common receipt formats here.
  if (matches(bytes, 0, [0x50, 0x4b, 0x03, 0x04])) {
    const asText = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 4096)));
    if (asText.includes('word/')) {
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      };
    }
    if (asText.includes('xl/')) {
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    }
    if (asText.includes('ppt/')) {
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        extension: 'pptx',
      };
    }
    return { contentType: 'application/zip', extension: 'zip' };
  }
  // Legacy MS Office: D0 CF 11 E0 A1 B1 1A E1 — could be doc, xls, ppt.
  // We can't cheaply tell which, so return the generic type.
  if (matches(bytes, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { contentType: 'application/x-ole-storage', extension: 'doc' };
  }

  // Plain text heuristic: if the first 512 bytes are mostly ASCII printables,
  // call it text. Not perfect but avoids serving a truly opaque .bin.
  const sample = bytes.slice(0, Math.min(bytes.length, 512));
  let printable = 0;
  for (const b of Array.from(sample)) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126)) printable++;
  }
  if (sample.length > 0 && printable / sample.length > 0.9) {
    return { contentType: 'text/plain', extension: 'txt' };
  }

  return UNKNOWN;
};
