import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Job, Queue } from "bullmq";
import { env } from "../lib/env.js";
import { PrismaService } from "../prisma/prisma.service.js";

export const MAINTENANCE_QUEUE = "maintenance";

const NOTIFICATION_RETENTION_DAYS = 90;
const INACTIVE_DEVICE_RETENTION_DAYS = 180;

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cleanupExpiredTokens() {
    const now = new Date();
    const notificationCutoff = new Date(
      now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const deviceCutoff = new Date(
      now.getTime() - INACTIVE_DEVICE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const caseSequenceCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [refreshTokens, passwordResetTokens, notifications, devices, sequences] =
      await this.prisma.$transaction([
        this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
        this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
        this.prisma.notification.deleteMany({ where: { createdAt: { lt: notificationCutoff } } }),
        this.prisma.deviceToken.deleteMany({
          where: { isActive: false, updatedAt: { lt: deviceCutoff } },
        }),
        this.prisma.supportCaseSequence.deleteMany({
          where: { dateKey: { lt: caseSequenceCutoff } },
        }),
      ]);

    this.logger.log({
      deletedRefreshTokens: refreshTokens.count,
      deletedPasswordResetTokens: passwordResetTokens.count,
      deletedNotifications: notifications.count,
      deletedInactiveDevices: devices.count,
      deletedCaseSequences: sequences.count,
    });
  }
}

/**
 * Always-on daily cleanup via Nest Schedule.
 * When Redis/Bull is available, MaintenanceScheduler enqueues a deduped job instead.
 */
@Injectable()
export class MaintenanceCronService {
  private readonly logger = new Logger(MaintenanceCronService.name);

  constructor(private readonly cleanup: TokenCleanupService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDirectCleanup() {
    if (env.REDIS_URL) return;
    this.logger.log("Running token cleanup without Redis/Bull");
    await this.cleanup.cleanupExpiredTokens();
  }
}

@Injectable()
export class MaintenanceScheduler {
  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduleTokenCleanup() {
    await this.queue.add(
      "cleanup-expired-tokens",
      {},
      {
        jobId: `cleanup-${new Date().toISOString().slice(0, 10)}`,
        removeOnComplete: 30,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );
  }
}

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly cleanup: TokenCleanupService) {
    super();
  }

  async process(job: Job) {
    if (job.name !== "cleanup-expired-tokens") return;
    this.logger.log({ jobId: job.id, msg: "Running queued token cleanup" });
    await this.cleanup.cleanupExpiredTokens();
  }
}
