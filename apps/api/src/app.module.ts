import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { AdminModule } from "./admin/admin.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CategoriesModule } from "./categories/categories.module.js";
import { CommonModule } from "./common/common.module.js";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware.js";
import { ConversationsModule } from "./conversations/conversations.module.js";
import { DevicesModule } from "./devices/devices.module.js";
import { HealthModule } from "./health/health.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { env, validateEnvironment } from "./lib/env.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RequestsModule } from "./requests/requests.module.js";
import { UploadsModule } from "./uploads/uploads.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        redact: {
          paths: [
            "req.headers.authorization",
            "req.body.password",
            "req.body.refreshToken",
            "req.body.token",
          ],
          censor: "[REDACTED]",
        },
      },
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    AdminModule,
    HealthModule,
    CategoriesModule,
    RequestsModule,
    ConversationsModule,
    NotificationsModule,
    UploadsModule,
    UsersModule,
    DevicesModule,
    ...(env.REDIS_URL ? [JobsModule] : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
