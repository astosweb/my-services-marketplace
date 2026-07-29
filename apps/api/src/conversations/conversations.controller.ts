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
import {
  ConversationListQueryDto,
  SendConversationMessageDto,
  UpdateArchiveDto,
  UpdatePinDto,
} from "./conversations.dto.js";
import { ConversationsService } from "./conversations.service.js";

@ApiTags("Conversations")
@ApiStandardErrors()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: "List conversation inbox rows" })
  list(@CurrentUserId() userId: string, @Query() query: ConversationListQueryDto) {
    return this.conversationsService.list(userId, query);
  }

  @Patch(":id/archive")
  @ApiOperation({ summary: "Archive or restore a conversation" })
  async archive(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: UpdateArchiveDto,
  ) {
    return { data: await this.conversationsService.archive(id, userId, data.isArchived) };
  }

  @Patch(":id/pin")
  @ApiOperation({ summary: "Pin or unpin a conversation" })
  async pin(@Param("id") id: string, @CurrentUserId() userId: string, @Body() data: UpdatePinDto) {
    return { data: await this.conversationsService.pin(id, userId, data.isPinned) };
  }

  @Get(":id/messages")
  @ApiOperation({ summary: "List messages and mark the conversation read" })
  async messages(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.conversationsService.messages(id, userId) };
  }

  @Post(":id/messages")
  @ApiOperation({ summary: "Send a conversation message" })
  async send(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: SendConversationMessageDto,
  ) {
    return { data: await this.conversationsService.send(id, userId, data) };
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a conversation read" })
  async read(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.conversationsService.read(id, userId) };
  }
}
