import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AdminModule } from "./admin/admin.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CategoriesModule } from "./categories/categories.module.js";
import { CommonModule } from "./common/common.module.js";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard.js";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware.js";
import { ConversationsModule } from "./conversations/conversations.module.js";
import { DevicesModule } from "./devices/devices.module.js";
import { HealthModule } from "./health/health.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { env, validateEnvironment } from "./lib/env.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { PushModule } from "./push/push.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { RequestsModule } from "./requests/requests.module.js";
import { SupportModule } from "./support/support.module.js";
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
            "req.headers.cookie",
            "req.query.token",
            "req.query.exp",
            "req.body.password",
            "req.body.currentPassword",
            "req.body.refreshToken",
            "req.body.token",
            "req.url",
          ],
          censor: "[REDACTED]",
        },
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // 100 requests per minute
    }]),
    PrismaModule,
    CommonModule,
    RealtimeModule,
    AuthModule,
    AdminModule,
    HealthModule,
    CategoriesModule,
    RequestsModule,
    ConversationsModule,
    NotificationsModule,
    PushModule,
    UploadsModule,
    UsersModule,
    DevicesModule,
    SupportModule,
    JobsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
