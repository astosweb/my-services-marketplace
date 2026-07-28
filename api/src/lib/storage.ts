import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { badRequest, serviceUnavailable } from "./errors.js";
import { env, uploadUsesSpaces } from "./env.js";

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
const MAX_FILES = 6;

const localUploadRoot = path.resolve(process.cwd(), ".data/uploads");

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
      await client.send(
        new PutObjectCommand({
          Bucket: env.SPACES_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ACL: "public-read",
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

export async function uploadRequestPhotos(userId: string, files: File[]) {
  if (files.length === 0) throw badRequest("No photos provided");
  if (files.length > MAX_FILES) throw badRequest(`At most ${MAX_FILES} photos allowed`);

  const keys: string[] = [];

  for (const file of files) {
    if (!IMAGE_TYPES.has(file.type)) {
      throw badRequest("Only JPEG, PNG, and WebP images are allowed");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_PHOTO_BYTES) {
      throw badRequest("Each photo must be 8 MB or smaller");
    }

    const ext = extensionFor(file.type);
    const key = `requests/${userId}/${randomUUID()}.${ext}`;
    await storeBuffer(key, buffer, file.type);
    keys.push(key);
  }

  return keys;
}

export async function uploadMessageAttachment(userId: string, file: File) {
  const mimeType = file.type || "application/octet-stream";
  if (!MESSAGE_ATTACHMENT_TYPES.has(mimeType)) {
    throw badRequest("Unsupported file type. Use images, PDF, or common document formats.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_MESSAGE_ATTACHMENT_BYTES) {
    throw badRequest("Attachment must be 15 MB or smaller");
  }

  const ext = extensionFor(mimeType);
  const key = `messages/${userId}/${randomUUID()}.${ext}`;
  await storeBuffer(key, buffer, mimeType);

  const name = file.name?.trim() || `attachment.${ext}`;
  return { key, name, mimeType };
}

export async function uploadAvatar(userId: string, file: File) {
  if (!IMAGE_TYPES.has(file.type)) {
    throw badRequest("Only JPEG, PNG, and WebP images are allowed");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw badRequest("Avatar must be 8 MB or smaller");
  }

  const ext = extensionFor(file.type);
  const key = `avatars/${userId}/${randomUUID()}.${ext}`;
  await storeBuffer(key, buffer, file.type);
  return { key };
}

export function localUploadPath(key: string) {
  const resolved = path.resolve(localUploadRoot, key);
  if (!resolved.startsWith(localUploadRoot + path.sep) && resolved !== localUploadRoot) {
    throw badRequest("Invalid upload path");
  }
  return resolved;
}
