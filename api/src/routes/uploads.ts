import { Hono } from "hono";
import { badRequest } from "../lib/errors.js";
import {
  uploadAvatar,
  uploadMessageAttachment,
  uploadRequestPhotos,
} from "../lib/storage.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";

export const uploadRoutes = new Hono<{ Variables: AuthVariables }>();

function collectPhotoFiles(value: unknown): File[] {
  if (!value) return [];
  if (value instanceof File) return value.size > 0 ? [value] : [];
  if (Array.isArray(value)) {
    return value.filter((item): item is File => item instanceof File && item.size > 0);
  }
  return [];
}

function singleFile(value: unknown): File | undefined {
  if (value instanceof File && value.size > 0) return value;
  if (Array.isArray(value)) {
    return value.find((item): item is File => item instanceof File && item.size > 0);
  }
  return undefined;
}

uploadRoutes.post("/request-photos", requireAuth, async (c) => {
  // `all: true` keeps every file when multiple parts share the "photos" field.
  const body = await c.req.parseBody({ all: true });
  const files = collectPhotoFiles(body.photos);
  if (files.length === 0) throw badRequest('Include at least one image in the "photos" field');

  const keys = await uploadRequestPhotos(c.get("userId"), files);
  return c.json({ data: { keys } });
});

uploadRoutes.post("/message-attachments", requireAuth, async (c) => {
  const body = await c.req.parseBody({ all: true });
  const file = singleFile(body.file);
  if (!file) throw badRequest('Include a file in the "file" field');

  const data = await uploadMessageAttachment(c.get("userId"), file);
  return c.json({ data });
});

uploadRoutes.post("/avatars", requireAuth, async (c) => {
  const body = await c.req.parseBody({ all: true });
  const file = singleFile(body.file) ?? singleFile(body.avatar);
  if (!file) throw badRequest('Include an image in the "file" field');

  const data = await uploadAvatar(c.get("userId"), file);
  return c.json({ data });
});
