import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import type { RequestClientMeta } from "../lib/request-meta.js";
import { conflict, forbidden } from "../lib/errors.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RegisterDeviceDto } from "./devices.dto.js";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, data: RegisterDeviceDto, meta?: RequestClientMeta) {
    const device = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.deviceToken.findUnique({
        where: { token: data.token },
        select: { id: true, userId: true },
      });
      if (existing && existing.userId !== userId) {
        throw forbidden("This device is already registered to another account");
      }

      const fields = {
        platform: data.platform,
        name: data.name ?? null,
        systemVersion: data.systemVersion ?? null,
        appVersion: data.appVersion ?? null,
        ipAddress: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null,
        isActive: true,
      };

      if (existing) {
        return transaction.deviceToken.update({
          where: { id: existing.id },
          data: {
            platform: data.platform,
            isActive: true,
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.systemVersion !== undefined ? { systemVersion: data.systemVersion } : {}),
            ...(data.appVersion !== undefined ? { appVersion: data.appVersion } : {}),
            ...(meta?.ipAddress ? { ipAddress: meta.ipAddress } : {}),
            ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
          },
        });
      }

      try {
        return await transaction.deviceToken.create({
          data: { userId, token: data.token, ...fields },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw conflict("Device token registration conflict; retry");
        }
        throw error;
      }
    });

    return {
      id: device.id,
      token: device.token,
      platform: device.platform,
      name: device.name,
      systemVersion: device.systemVersion,
      appVersion: device.appVersion,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
      isActive: device.isActive,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }

  async remove(userId: string, encodedToken: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { token: decodeURIComponent(encodedToken), userId },
    });
    return { ok: true };
  }
}
