import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { badRequest, serviceUnavailable } from "./errors.js";
import { env, uploadUsesSpaces } from "./env.js";
import { assertMimeMatchesContent } from "./mime-sniff.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MESSAGE_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MESSAGE_ATTACHMENT_TYPES = new Set([...IMAGE_TYPES, ...MESSAGE_FILE_TYPES]);

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_MESSAGE_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 9;

const PHOTO_MAX_DIMENSION = 1920;
const AVATAR_MAX_DIMENSION = 1024;
const PHOTO_JPEG_QUALITY = 80;
const AVATAR_JPEG_QUALITY = 82;

const localUploadRoot = path.resolve(process.cwd(), ".data/uploads");

export type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const EXT_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

let s3: S3Client | null = null;

function getS3() {
  if (!uploadUsesSpaces()) return null;
  if (!s3) {
    s3 = new S3Client({
      region: env.SPACES_REGION!,
      endpoint: env.SPACES_ENDPOINT!,
      credentials: {
        accessKeyId: env.SPACES_ACCESS_KEY_ID!,
        secretAccessKey: env.SPACES_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: false,
    });
  }
  return s3;
}

function extensionFor(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "text/plain") return "txt";
  if (contentType === "application/msword") return "doc";
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx";
  }
  if (contentType === "application/vnd.ms-excel") return "xls";
  if (contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "xlsx";
  }
  return "jpg";
}

export function contentTypeForUploadKey(key: string, fallback?: string | null) {
  if (fallback) return fallback;
  const ext = path.extname(key).toLowerCase();
  return EXT_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function rethrowStorageError(err: unknown): never {
  const code = (err as { Code?: string; name?: string }).Code ?? (err as { name?: string }).name;
  if (
    code === "InvalidAccessKeyId" ||
    code === "SignatureDoesNotMatch" ||
    code === "AccessDenied"
  ) {
    throw serviceUnavailable("File storage is not configured correctly. Try again later.");
  }
  throw err;
}

async function storeBuffer(key: string, buffer: Buffer, contentType: string) {
  const client = getS3();
  if (client && env.SPACES_BUCKET) {
    try {
      // No object ACL — Spaces with ACLs disabled reject it. Public CDN access for
      // requests/avatars is via Space/bucket policy; messages/ stay private + signed URLs.
      await client.send(
        new PutObjectCommand({
          Bucket: env.SPACES_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      rethrowStorageError(err);
    }
  } else {
    const dest = path.join(localUploadRoot, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
  }
}

/** Resize + JPEG-encode images before storage. Honors EXIF orientation. */
export async function compressImageBuffer(
  buffer: Buffer,
  options: { maxDimension: number; quality: number },
): Promise<{ buffer: Buffer; contentType: "image/jpeg"; ext: "jpg" }> {
  try {
    const compressed = await sharp(buffer)
      .rotate()
      .resize({
        width: options.maxDimension,
        height: options.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: options.quality, mozjpeg: true })
      .toBuffer();
    return { buffer: compressed, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    throw badRequest("Could not process image. Try another photo.");
  }
}

async function fileData(file: File | UploadFile) {
  if ("buffer" in file) {
    return {
      buffer: file.buffer,
      mimeType: file.mimetype,
      name: file.originalname,
      size: file.size,
    };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, mimeType: file.type, name: file.name, size: buffer.byteLength };
}

/** Return byte size of a stored upload without loading the full object when possible. */
export async function getUploadObjectSize(key: string): Promise<number | null> {
  const client = getS3();
  if (client && env.SPACES_BUCKET) {
    try {
      const result = await client.send(
        new HeadObjectCommand({
          Bucket: env.SPACES_BUCKET,
          Key: key,
        }),
      );
      return typeof result.ContentLength === "number" ? result.ContentLength : null;
    } catch (err) {
      const code =
        (err as { name?: string; Code?: string }).name ?? (err as { Code?: string }).Code;
      if (code === "NoSuchKey" || code === "NotFound" || code === "404") return null;
      rethrowStorageError(err);
    }
  }

  try {
    const info = await stat(localUploadPath(key));
    return info.size;
  } catch {
    return null;
  }
}

/** Read an uploaded object from Spaces or local disk. */
export async function readUploadObject(key: string) {
  const client = getS3();
  if (client && env.SPACES_BUCKET) {
    try {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: env.SPACES_BUCKET,
          Key: key,
        }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) return null;
      return {
        data: Buffer.from(bytes),
        contentType: contentTypeForUploadKey(key, result.ContentType),
      };
    } catch (err) {
      const code =
        (err as { name?: string; Code?: string }).name ?? (err as { Code?: string }).Code;
      if (code === "NoSuchKey" || code === "NotFound") return null;
      rethrowStorageError(err);
    }
  }

  try {
    const data = await readFile(localUploadPath(key));
    return { data, contentType: contentTypeForUploadKey(key) };
  } catch {
    return null;
  }
}

export async function uploadRequestPhotos(userId: string, files: (File | UploadFile)[]) {
  if (files.length === 0) throw badRequest("No photos provided");
  if (files.length > MAX_FILES) throw badRequest(`At most ${MAX_FILES} photos allowed`);

  const keys: string[] = [];

  for (const file of files) {
    const rawFile = await fileData(file);
    if (!IMAGE_TYPES.has(rawFile.mimeType)) {
      throw badRequest("Only JPEG, PNG, and WebP images are allowed");
    }
    if (rawFile.size > MAX_PHOTO_BYTES) {
      throw badRequest("Each photo must be 8 MB or smaller");
    }

    const { buffer, contentType, ext } = await compressImageBuffer(rawFile.buffer, {
      maxDimension: PHOTO_MAX_DIMENSION,
      quality: PHOTO_JPEG_QUALITY,
    });
    const key = `requests/${userId}/${randomUUID()}.${ext}`;
    await storeBuffer(key, buffer, contentType);
    keys.push(key);
  }

  return keys;
}

export async function uploadMessageAttachment(userId: string, file: File | UploadFile) {
  const rawFile = await fileData(file);
  const mimeType = rawFile.mimeType || "application/octet-stream";
  if (!MESSAGE_ATTACHMENT_TYPES.has(mimeType)) {
    throw badRequest("Unsupported file type. Use images, PDF, or common document formats.");
  }

  if (rawFile.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
    throw badRequest("Attachment must be 15 MB or smaller");
  }

  assertMimeMatchesContent(mimeType, rawFile.buffer);

  if (IMAGE_TYPES.has(mimeType)) {
    const { buffer, contentType, ext } = await compressImageBuffer(rawFile.buffer, {
      maxDimension: PHOTO_MAX_DIMENSION,
      quality: PHOTO_JPEG_QUALITY,
    });
    const key = `messages/${userId}/${randomUUID()}.${ext}`;
    await storeBuffer(key, buffer, contentType);
    const name = rawFile.name.trim() || `attachment.${ext}`;
    return { key, name: name.replace(/\.[^.]+$/, `.${ext}`), mimeType: contentType };
  }

  const ext = extensionFor(mimeType);
  const key = `messages/${userId}/${randomUUID()}.${ext}`;
  await storeBuffer(key, rawFile.buffer, mimeType);

  const name = rawFile.name.trim() || `attachment.${ext}`;
  return { key, name, mimeType };
}

export async function uploadSupportAttachment(userId: string, file: File | UploadFile) {
  const rawFile = await fileData(file);
  const mimeType = rawFile.mimeType || "application/octet-stream";
  if (!MESSAGE_ATTACHMENT_TYPES.has(mimeType)) {
    throw badRequest("Unsupported file type. Use images, PDF, or common document formats.");
  }

  if (rawFile.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
    throw badRequest("Attachment must be 15 MB or smaller");
  }

  assertMimeMatchesContent(mimeType, rawFile.buffer);

  if (IMAGE_TYPES.has(mimeType)) {
    const { buffer, contentType, ext } = await compressImageBuffer(rawFile.buffer, {
      maxDimension: PHOTO_MAX_DIMENSION,
      quality: PHOTO_JPEG_QUALITY,
    });
    const key = `support/${userId}/${randomUUID()}.${ext}`;
    await storeBuffer(key, buffer, contentType);
    const name = rawFile.name.trim() || `attachment.${ext}`;
    return {
      key,
      name: name.replace(/\.[^.]+$/, `.${ext}`),
      mimeType: contentType,
      sizeBytes: buffer.byteLength,
    };
  }

  const ext = extensionFor(mimeType);
  const key = `support/${userId}/${randomUUID()}.${ext}`;
  await storeBuffer(key, rawFile.buffer, mimeType);
  const name = rawFile.name.trim() || `attachment.${ext}`;
  return { key, name, mimeType, sizeBytes: rawFile.size };
}

export async function uploadAvatar(userId: string, file: File | UploadFile) {
  const rawFile = await fileData(file);
  if (!IMAGE_TYPES.has(rawFile.mimeType)) {
    throw badRequest("Only JPEG, PNG, and WebP images are allowed");
  }

  if (rawFile.size > MAX_PHOTO_BYTES) {
    throw badRequest("Avatar must be 8 MB or smaller");
  }

  const { buffer, contentType, ext } = await compressImageBuffer(rawFile.buffer, {
    maxDimension: AVATAR_MAX_DIMENSION,
    quality: AVATAR_JPEG_QUALITY,
  });
  const key = `avatars/${userId}/${randomUUID()}.${ext}`;
  await storeBuffer(key, buffer, contentType);
  return { key };
}

export function localUploadPath(key: string) {
  const resolved = path.resolve(localUploadRoot, key);
  if (!resolved.startsWith(localUploadRoot + path.sep) && resolved !== localUploadRoot) {
    throw badRequest("Invalid upload path");
  }
  return resolved;
}
