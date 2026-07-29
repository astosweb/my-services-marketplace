import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service.js";

export const MAINTENANCE_QUEUE = "maintenance";

@Injectable()
export class MaintenanceScheduler {
  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduleTokenCleanup() {
    await this.queue.add(
      "cleanup-expired-tokens",
      {},
      { jobId: `cleanup-${new Date().toISOString().slice(0, 10)}`, removeOnComplete: 30 },
    );
  }
}

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    if (job.name !== "cleanup-expired-tokens") return;
    const now = new Date();
    const [refreshTokens, passwordResetTokens] = await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
    this.logger.log({
      jobId: job.id,
      deletedRefreshTokens: refreshTokens.count,
      deletedPasswordResetTokens: passwordResetTokens.count,
    });
  }
}
