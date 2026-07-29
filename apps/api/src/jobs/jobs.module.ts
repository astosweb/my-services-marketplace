import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { env } from "../lib/env.js";
import { MAINTENANCE_QUEUE, MaintenanceProcessor, MaintenanceScheduler } from "./jobs.service.js";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => {
        const redisUrl = new URL(env.REDIS_URL!);
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            username: redisUrl.username || undefined,
            password: redisUrl.password || undefined,
            ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
          },
          prefix: "hero",
        };
      },
    }),
    BullModule.registerQueue({ name: MAINTENANCE_QUEUE }),
  ],
  providers: [MaintenanceScheduler, MaintenanceProcessor],
})
export class JobsModule {}
