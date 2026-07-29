import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RegisterDeviceDto } from "./devices.dto.js";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, data: RegisterDeviceDto) {
    const device = await this.prisma.deviceToken.upsert({
      where: { token: data.token },
      create: { userId, token: data.token, platform: data.platform },
      update: { userId, platform: data.platform },
    });
    return {
      id: device.id,
      token: device.token,
      platform: device.platform,
      createdAt: device.createdAt.toISOString(),
    };
  }

  async remove(userId: string, encodedToken: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { token: decodeURIComponent(encodedToken), userId },
    });
    return { ok: true };
  }
}
