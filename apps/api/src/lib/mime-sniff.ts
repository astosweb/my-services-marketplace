import { badRequest } from "./errors.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Detect MIME from magic bytes for allowed attachment types.
 * Returns null when the buffer does not match a known safe signature.
 */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  // UTF-8 / ASCII plain text: reject control chars except tab/LF/CR
  if (buffer.length > 0 && buffer.length <= 15 * 1024 * 1024) {
    let printable = true;
    for (let i = 0; i < Math.min(buffer.length, 8_192); i++) {
      const byte = buffer[i]!;
      if (byte === 0) {
        printable = false;
        break;
      }
      if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) {
        // allow common whitespace; reject other C0 controls
        if (byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
          printable = false;
          break;
        }
      }
    }
    if (printable && !buffer.includes(0)) {
      // Only treat as text when client claimed text/plain — caller decides.
    }
  }
  // OLE Compound File (legacy .doc / .xls)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return "application/msword"; // also covers xls; further validated by claimed mime
  }
  // ZIP-based Office Open XML (.docx / .xlsx) or generic zip
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)) {
    return "application/zip";
  }
  return null;
}

const ZIP_OFFICE_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const OLE_MIMES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
]);

/**
 * Validate that buffer magic bytes are consistent with the declared MIME.
 * Images are re-validated by sharp separately; this covers non-image attachments.
 */
export function assertMimeMatchesContent(declaredMime: string, buffer: Buffer) {
  if (IMAGE_TYPES.has(declaredMime)) {
    const sniffed = sniffMimeType(buffer);
    if (sniffed !== declaredMime) {
      throw badRequest("File content does not match the declared image type");
    }
    return;
  }

  if (declaredMime === "application/pdf") {
    if (sniffMimeType(buffer) !== "application/pdf") {
      throw badRequest("File content is not a valid PDF");
    }
    return;
  }

  if (declaredMime === "text/plain") {
    if (buffer.includes(0)) {
      throw badRequest("File content is not plain text");
    }
    return;
  }

  if (ZIP_OFFICE_MIMES.has(declaredMime)) {
    if (sniffMimeType(buffer) !== "application/zip") {
      throw badRequest("File content does not match the declared Office document type");
    }
    return;
  }

  if (OLE_MIMES.has(declaredMime)) {
    const sniffed = sniffMimeType(buffer);
    if (sniffed !== "application/msword") {
      throw badRequest("File content does not match the declared document type");
    }
  }
}
