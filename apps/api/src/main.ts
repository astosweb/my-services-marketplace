import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { assertProductionCors, corsOrigins, env } from "./lib/env.js";
import { badRequest } from "./lib/errors.js";

async function bootstrap() {
  assertProductionCors();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.useBodyParser("json", { limit: "80mb" });
  app.useBodyParser("urlencoded", { limit: "80mb", extended: true });
  app.enableCors({
    origin: corsOrigins(),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      exceptionFactory: (errors) =>
        badRequest(
          errors
            .flatMap((error) =>
              Object.values(error.constraints ?? {}).map(
                (message) => `${error.property}: ${message}`,
              ),
            )
            .join("; ") || "Invalid request",
        ),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const openApi = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Bidy API")
      .setDescription("Marketplace, messaging, notification, and upload API")
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, openApi, {
    jsonDocumentUrl: "docs/openapi.json",
  });

  await app.listen(env.PORT, "0.0.0.0");
  Logger.log(`Bidy API listening on port ${env.PORT}`, "Bootstrap");
}

await bootstrap();
