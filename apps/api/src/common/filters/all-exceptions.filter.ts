import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { REQUEST_ID_HEADER } from "../middleware/request-id.middleware.js";

const statusCodes: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = request.header(REQUEST_ID_HEADER);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let code = "INTERNAL";

    if (exception instanceof AppError) {
      status = exception.status;
      message = exception.message;
      code = exception.code ?? statusCodes[status] ?? "ERROR";
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        message = "Resource already exists";
        code = "CONFLICT";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        message = "Resource not found";
        code = "NOT_FOUND";
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      const payloadMessage =
        typeof payload === "object" && payload !== null && "message" in payload
          ? (payload as { message: string | string[] }).message
          : exception.message;
      message = Array.isArray(payloadMessage) ? payloadMessage.join("; ") : payloadMessage;
      if (status === HttpStatus.NOT_FOUND) message = "Not found";
      code = statusCodes[status] ?? "HTTP_ERROR";
    } else if (exception instanceof SyntaxError && /JSON/i.test(exception.message)) {
      status = HttpStatus.BAD_REQUEST;
      message = "Invalid JSON body";
      code = "BAD_REQUEST";
    }

    const statusCode = Number(status);
    if (statusCode >= 500) {
      this.logger.error(
        { requestId, path: request.originalUrl, exception },
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      error: {
        message,
        code,
        ...(requestId ? { requestId } : {}),
      },
    });
  }
}
