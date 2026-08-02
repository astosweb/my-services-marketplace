import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import {
  AdminApproveRequestDto,
  AdminBulkUsersDto,
  AdminConversationsQueryDto,
  AdminCreateRequestDto,
  AdminOffersQueryDto,
  AdminRejectRequestDto,
  AdminRequestsQueryDto,
  AdminReviewsQueryDto,
  AdminUpdateOfferDto,
  AdminUpdateRequestDto,
  AdminUpdateUserDto,
  AdminUsersQueryDto,
} from "./admin.dto.js";
import { AdminService } from "./admin.service.js";

@ApiTags("Admin")
@ApiBearerAuth()
@ApiStandardErrors()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("dashboard/stats")
  @ApiOperation({ summary: "Marketplace dashboard metrics" })
  async dashboardStats() {
    return { data: await this.adminService.dashboardStats() };
  }

  @Get("users/export")
  @ApiOperation({ summary: "Export users as CSV" })
  @ApiProduces("text/csv")
  async exportUsers(@Res() res: Response) {
    const csv = await this.adminService.exportUsersCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="users.csv"');
    res.send(csv);
  }

  @Get("users")
  @ApiOperation({ summary: "List users" })
  async listUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get("users/:id")
  @ApiOperation({ summary: "Get user detail" })
  async getUser(@Param("id") id: string) {
    return { data: await this.adminService.getUser(id) };
  }

  @Patch("users/:id")
  @ApiOperation({ summary: "Update user" })
  async updateUser(
    @Param("id") id: string,
    @CurrentUserId() actorId: string,
    @Body() body: AdminUpdateUserDto,
  ) {
    return { data: await this.adminService.updateUser(id, actorId, body) };
  }

  @Delete("users/:id")
  @ApiOperation({ summary: "Delete user" })
  async deleteUser(@Param("id") id: string, @CurrentUserId() actorId: string) {
    await this.adminService.deleteUser(id, actorId);
    return { data: { deleted: true as const } };
  }

  @Post("users/bulk")
  @ApiOperation({ summary: "Bulk user actions" })
  async bulkUsers(@Body() body: AdminBulkUsersDto, @CurrentUserId() actorId: string) {
    return { data: await this.adminService.bulkUsers(actorId, body) };
  }

  @Post("requests")
  @ApiOperation({ summary: "Create a new service request" })
  async createRequest(
    @CurrentUserId() actorId: string,
    @Body() body: AdminCreateRequestDto,
  ) {
    return { data: await this.adminService.createRequest(actorId, body) };
  }

  @Get("requests")
  @ApiOperation({ summary: "List service requests" })
  async listRequests(@Query() query: AdminRequestsQueryDto) {
    return this.adminService.listRequests(query);
  }

  @Get("requests/:id")
  @ApiOperation({ summary: "Get service request detail" })
  async getRequest(@Param("id") id: string) {
    return { data: await this.adminService.getRequest(id) };
  }

  @Patch("requests/:id")
  @ApiOperation({ summary: "Update service request" })
  async updateRequest(
    @Param("id") id: string,
    @CurrentUserId() actorId: string,
    @Body() body: AdminUpdateRequestDto,
  ) {
    return { data: await this.adminService.updateRequest(id, actorId, body) };
  }

  @Post("requests/:id/approve")
  @ApiOperation({ summary: "Approve a pending service request" })
  async approveRequest(
    @Param("id") id: string,
    @CurrentUserId() actorId: string,
    @Body() body: AdminApproveRequestDto,
  ) {
    return { data: await this.adminService.approveRequest(id, actorId, body) };
  }

  @Post("requests/:id/reject")
  @ApiOperation({ summary: "Reject a service request" })
  async rejectRequest(
    @Param("id") id: string,
    @CurrentUserId() actorId: string,
    @Body() body: AdminRejectRequestDto,
  ) {
    return { data: await this.adminService.rejectRequest(id, actorId, body) };
  }

  @Delete("requests/:id")
  @ApiOperation({ summary: "Delete service request" })
  async deleteRequest(@Param("id") id: string, @CurrentUserId() actorId: string) {
    await this.adminService.deleteRequest(id, actorId);
    return { data: { deleted: true as const } };
  }

  @Get("offers")
  @ApiOperation({ summary: "List offers" })
  async listOffers(@Query() query: AdminOffersQueryDto) {
    return this.adminService.listOffers(query);
  }

  @Patch("offers/:id")
  @ApiOperation({ summary: "Update offer status" })
  async updateOffer(@Param("id") id: string, @Body() body: AdminUpdateOfferDto) {
    return { data: await this.adminService.updateOffer(id, body) };
  }

  @Delete("offers/:id")
  @ApiOperation({ summary: "Delete offer" })
  async deleteOffer(@Param("id") id: string) {
    await this.adminService.deleteOffer(id);
    return { data: { deleted: true as const } };
  }

  @Get("reviews")
  @ApiOperation({ summary: "List reviews" })
  async listReviews(@Query() query: AdminReviewsQueryDto) {
    return this.adminService.listReviews(query);
  }

  @Delete("reviews/:id")
  @ApiOperation({ summary: "Delete review and recompute rating" })
  async deleteReview(@Param("id") id: string) {
    await this.adminService.deleteReview(id);
    return { data: { deleted: true as const } };
  }

  @Get("categories")
  @ApiOperation({ summary: "List categories with request counts" })
  async listCategories() {
    return { data: await this.adminService.listCategories() };
  }

  @Get("conversations")
  @ApiOperation({ summary: "List conversations for moderation" })
  async listConversations(@Query() query: AdminConversationsQueryDto) {
    return this.adminService.listConversations(query);
  }

  @Get("conversations/:id/messages")
  @ApiOperation({ summary: "Get complete message history for a conversation" })
  async getConversationMessages(@Param("id") id: string) {
    return { data: await this.adminService.getConversationMessages(id) };
  }

  @Get("roles")
  @ApiOperation({ summary: "System roles and their permissions" })
  @ApiOkResponse({ description: "Read-only role catalog" })
  listRoles() {
    return { data: this.adminService.listRoles() };
  }

  @Get("permissions")
  @ApiOperation({ summary: "Permission catalog" })
  listPermissions() {
    return { data: this.adminService.listPermissions() };
  }

  @Get("system/status")
  @ApiOperation({ summary: "API and database health" })
  async systemStatus() {
    return { data: await this.adminService.systemStatus() };
  }
}
