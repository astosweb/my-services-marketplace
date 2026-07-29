import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { MarkNotificationReadDto, NotificationListQueryDto } from "./notifications.dto.js";
import { NotificationsService } from "./notifications.service.js";

@ApiTags("Notifications")
@ApiStandardErrors()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List notifications" })
  list(@CurrentUserId() userId: string, @Query() query: NotificationListQueryDto) {
    return this.notificationsService.list(userId, query);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Mark a notification as read" })
  async markRead(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body() _data: MarkNotificationReadDto,
  ) {
    return { data: await this.notificationsService.markRead(userId, id) };
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all notifications as read" })
  async readAll(@CurrentUserId() userId: string) {
    return { data: await this.notificationsService.readAll(userId) };
  }
}
