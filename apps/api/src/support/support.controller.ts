import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import {
  SupportCreateRateLimit,
  SupportMessageRateLimit,
} from "../middleware/rate-limit.js";
import {
  CreateSupportTicketDto,
  SendSupportMessageDto,
  SupportTicketsQueryDto,
  SupportTypingDto,
} from "./support.dto.js";
import { SupportService } from "./support.service.js";

@ApiTags("Support")
@ApiStandardErrors()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("support")
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post("tickets")
  @SupportCreateRateLimit()
  @ApiOperation({ summary: "Create a support ticket" })
  async create(
    @CurrentUserId() userId: string,
    @Body() body: CreateSupportTicketDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    return {
      data: await this.supportService.createTicket(userId, body, { userAgent }),
    };
  }

  @Get("tickets")
  @ApiOperation({ summary: "List the current user's support tickets" })
  list(@CurrentUserId() userId: string, @Query() query: SupportTicketsQueryDto) {
    return this.supportService.listTickets({ userId, isAdmin: false }, query);
  }

  @Get("tickets/:id")
  @ApiOperation({ summary: "Get a support ticket with conversation history" })
  async get(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.supportService.getTicket(id, { userId, isAdmin: false }) };
  }

  @Post("tickets/:id/messages")
  @SupportMessageRateLimit()
  @ApiOperation({ summary: "Reply to a support ticket" })
  async sendMessage(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: SendSupportMessageDto,
  ) {
    return {
      data: await this.supportService.sendMessage(id, { userId, isAdmin: false }, body),
    };
  }

  @Post("tickets/:id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a support ticket as read" })
  async read(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.supportService.markRead(id, { userId, isAdmin: false }) };
  }

  @Post("tickets/:id/reopen")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reopen a resolved or closed ticket" })
  async reopen(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.supportService.reopen(id, { userId, isAdmin: false }) };
  }

  @Post("tickets/:id/typing")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Publish typing indicator for a ticket" })
  async setTyping(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: SupportTypingDto,
  ) {
    return {
      data: await this.supportService.publishTyping(id, userId, false, body.isTyping),
    };
  }

  @Get("tickets/:id/typing")
  @ApiOperation({ summary: "Get active typing indicators for a ticket" })
  async getTyping(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.supportService.getTypingForViewer(id, userId, false) };
  }
}
