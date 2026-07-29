import path from "node:path";
import { Injectable } from "@nestjs/common";
import { verifyAccessToken } from "../lib/auth.js";
import { forbidden, notFound, unauthorized } from "../lib/errors.js";
import {
  readUploadObject,
  uploadAvatar,
  uploadMessageAttachment,
  uploadRequestPhotos,
  type UploadFile,
} from "../lib/storage.js";
import { isPrivateUploadKey, verifyPrivateUploadToken } from "../lib/upload-access.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  requestPhotos(userId: string, files: UploadFile[]) {
    return uploadRequestPhotos(userId, files);
  }

  messageAttachment(userId: string, file: UploadFile) {
    return uploadMessageAttachment(userId, file);
  }

  avatar(userId: string, file: UploadFile) {
    return uploadAvatar(userId, file);
  }

  private async assertCanReadPrivateUpload(key: string, authorization?: string) {
    if (!authorization?.startsWith("Bearer ")) {
      throw unauthorized("Authentication required for private uploads");
    }
    const userId = await verifyAccessToken(authorization.slice(7));
    if (!userId) throw unauthorized("Authentication required for private uploads");
    if (key.startsWith(`messages/${userId}/`)) return;

    const message = await this.prisma.message.findFirst({
      where: { attachmentKey: key },
      select: {
        conversation: {
          select: { participants: { select: { userId: true } } },
        },
      },
    });
    if (!message?.conversation.participants.some((participant) => participant.userId === userId)) {
      throw forbidden("You do not have access to this file");
    }
  }

  async read(
    encodedKey: string,
    token: string | undefined,
    expires: string | undefined,
    authorization: string | undefined,
  ) {
    const key = decodeURIComponent(encodedKey);
    if (!key || key.includes("..") || path.isAbsolute(key)) throw notFound("File not found");
    if (isPrivateUploadKey(key) && !verifyPrivateUploadToken(key, token, expires)) {
      await this.assertCanReadPrivateUpload(key, authorization);
    }
    const object = await readUploadObject(key);
    if (!object) throw notFound("File not found");
    return { ...object, private: isPrivateUploadKey(key) };
  }
}
