import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { env } from "../lib/env.js";
import {
  MAINTENANCE_QUEUE,
  MaintenanceCronService,
  MaintenanceProcessor,
  MaintenanceScheduler,
  TokenCleanupService,
} from "./jobs.service.js";

const bullImports = env.REDIS_URL
  ? [
      BullModule.forRootAsync({
        useFactory: () => {
          const redisUrl = new URL(env.REDIS_URL!);
          const dbPath = redisUrl.pathname.replace(/^\//, "");
          const db = dbPath && /^\d+$/.test(dbPath) ? Number(dbPath) : undefined;
          return {
            connection: {
              host: redisUrl.hostname || "127.0.0.1",
              port: Number(redisUrl.port || 6379),
              username: redisUrl.username ? decodeURIComponent(redisUrl.username) : undefined,
              password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
              db,
              maxRetriesPerRequest: null,
              ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
            },
            prefix: "hero",
          };
        },
      }),
      BullModule.registerQueue({ name: MAINTENANCE_QUEUE }),
    ]
  : [];

@Module({
  imports: [ScheduleModule.forRoot(), ...bullImports],
  providers: [
    TokenCleanupService,
    MaintenanceCronService,
    ...(env.REDIS_URL ? [MaintenanceScheduler, MaintenanceProcessor] : []),
  ],
})
export class JobsModule {}
