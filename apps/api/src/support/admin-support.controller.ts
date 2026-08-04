import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { SupportMessageRateLimit } from "../middleware/rate-limit.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  CreateCannedResponseDto,
  CreateSupportNoteDto,
  MergeSupportTicketsDto,
  SendSupportMessageDto,
  SupportBulkActionDto,
  SupportTicketsQueryDto,
  SupportTypingDto,
  UpdateCannedResponseDto,
  UpdateSupportTicketDto,
} from "./support.dto.js";
import { SupportService } from "./support.service.js";

@ApiTags("Admin Support")
@ApiBearerAuth()
@ApiStandardErrors()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/support")
export class AdminSupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("stats")
  @ApiOperation({ summary: "Support desk dashboard statistics" })
  async stats() {
    return { data: await this.supportService.stats() };
  }

  @Get("tickets/export")
  @ApiOperation({ summary: "Export support tickets as CSV" })
  @ApiProduces("text/csv")
  async export(@Query() query: SupportTicketsQueryDto, @Res() res: Response) {
    const csv = await this.supportService.exportCsv(query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="support-tickets.csv"');
    res.send(csv);
  }

  @Get("tickets")
  @ApiOperation({ summary: "List all support tickets with filters" })
  list(@Query() query: SupportTicketsQueryDto, @CurrentUserId() userId: string) {
    return this.supportService.listTickets({ userId, isAdmin: true }, query);
  }

  @Post("tickets/bulk")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bulk update support tickets" })
  async bulk(@CurrentUserId() userId: string, @Body() body: SupportBulkActionDto) {
    return { data: await this.supportService.bulkAction(userId, body) };
  }

  @Get("tickets/:id")
  @ApiOperation({ summary: "Get support ticket detail for admins" })
  async get(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.supportService.getTicket(id, { userId, isAdmin: true }) };
  }

  @Patch("tickets/:id")
  @ApiOperation({ summary: "Update ticket status, priority, assignee, or tags" })
  async update(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateSupportTicketDto,
  ) {
    return { data: await this.supportService.updateTicket(id, userId, body) };
  }

  @Post("tickets/:id/messages")
  @SupportMessageRateLimit()
  @ApiOperation({ summary: "Reply to a support ticket as admin" })
  async sendMessage(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: SendSupportMessageDto,
  ) {
    return {
      data: await this.supportService.sendMessage(id, { userId, isAdmin: true }, body),
    };
  }

  @Post("tickets/:id/notes")
  @ApiOperation({ summary: "Add a private internal note" })
  async addNote(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateSupportNoteDto,
  ) {
    return { data: await this.supportService.addNote(id, userId, body) };
  }

  @Patch("tickets/:id/notes/:noteId")
  @ApiOperation({ summary: "Update a private internal note" })
  async updateNote(
    @Param("id") id: string,
    @Param("noteId") noteId: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateSupportNoteDto,
  ) {
    return { data: await this.supportService.updateNote(id, noteId, userId, body) };
  }

  @Delete("tickets/:id/notes/:noteId")
  @ApiOperation({ summary: "Delete a private internal note" })
  async deleteNote(
    @Param("id") id: string,
    @Param("noteId") noteId: string,
    @CurrentUserId() userId: string,
  ) {
    return { data: await this.supportService.deleteNote(id, noteId, userId) };
  }

  @Post("tickets/:id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a support ticket as read for admins" })
  async read(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.supportService.markRead(id, { userId, isAdmin: true }) };
  }

  @Post("tickets/:id/reopen")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reopen a resolved or closed ticket" })
  async reopen(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.supportService.reopen(id, { userId, isAdmin: true }) };
  }

  @Post("tickets/:id/merge")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Merge another ticket into this ticket" })
  async merge(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: MergeSupportTicketsDto,
  ) {
    return { data: await this.supportService.mergeTickets(id, userId, body) };
  }

  @Get("canned-responses")
  @ApiOperation({ summary: "List canned responses / macros" })
  async listCanned() {
    return { data: await this.supportService.listCannedResponses() };
  }

  @Post("canned-responses")
  @ApiOperation({ summary: "Create a canned response" })
  async createCanned(
    @CurrentUserId() userId: string,
    @Body() body: CreateCannedResponseDto,
  ) {
    return { data: await this.supportService.createCannedResponse(userId, body) };
  }

  @Patch("canned-responses/:id")
  @ApiOperation({ summary: "Update a canned response" })
  async updateCanned(@Param("id") id: string, @Body() body: UpdateCannedResponseDto) {
    return { data: await this.supportService.updateCannedResponse(id, body) };
  }

  @Delete("canned-responses/:id")
  @ApiOperation({ summary: "Delete a canned response" })
  async deleteCanned(@Param("id") id: string) {
    return { data: await this.supportService.deleteCannedResponse(id) };
  }

  @Post("tickets/:id/typing")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Publish admin typing indicator" })
  async setTyping(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: SupportTypingDto,
  ) {
    await this.supportService.getTicket(id, { userId, isAdmin: true });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true },
    });
    return {
      data: this.supportService.setTyping(
        id,
        { userId, displayName: user.displayName },
        body.isTyping,
      ),
    };
  }

  @Get("tickets/:id/typing")
  @ApiOperation({ summary: "Get typing indicators for a ticket" })
  async getTyping(@Param("id") id: string, @CurrentUserId() userId: string) {
    await this.supportService.getTicket(id, { userId, isAdmin: true });
    return { data: this.supportService.getTyping(id, userId) };
  }
}
