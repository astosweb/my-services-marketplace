import { Injectable } from "@nestjs/common";
import type { RequestClientMeta } from "../lib/request-meta.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RegisterDeviceDto } from "./devices.dto.js";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, data: RegisterDeviceDto, meta?: RequestClientMeta) {
    const device = await this.prisma.deviceToken.upsert({
      where: { token: data.token },
      create: {
        userId,
        token: data.token,
        platform: data.platform,
        name: data.name ?? null,
        systemVersion: data.systemVersion ?? null,
        appVersion: data.appVersion ?? null,
        ipAddress: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null,
        isActive: true,
      },
      update: {
        userId,
        platform: data.platform,
        isActive: true,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.systemVersion !== undefined ? { systemVersion: data.systemVersion } : {}),
        ...(data.appVersion !== undefined ? { appVersion: data.appVersion } : {}),
        ...(meta?.ipAddress ? { ipAddress: meta.ipAddress } : {}),
        ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
      },
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
