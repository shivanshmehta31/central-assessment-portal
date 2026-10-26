export type FileKind = 'pdf' | 'png' | 'jpg' | 'xlsx' | 'csv';

export const MIME_BY_KIND: Record<FileKind, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function extensionOf(filename: string) {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase();
}

// Detects the real type from the file's bytes — the client-supplied mimetype and
// extension are never trusted on their own, since uploaded files are later served back.
export function detectFileKind(buffer: Buffer, filename: string): FileKind | null {
  if (buffer.length < 4) return null;
  const ext = extensionOf(filename);

  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04 && ext === 'xlsx') {
    return 'xlsx';
  }
  if (ext === 'csv' || ext === 'txt') {
    const head = buffer.subarray(0, 2048);
    if (!head.includes(0)) return 'csv';
  }
  return null;
}

export function safeFilename(name: string) {
  return name.replace(/[^\w.\- ()]+/g, '_').slice(0, 150) || 'file';
}
