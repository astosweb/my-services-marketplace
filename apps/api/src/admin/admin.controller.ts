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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { LoginDto } from "../auth/auth.dto.js";
import { AuthService } from "../auth/auth.service.js";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { CredentialRateLimit } from "../middleware/rate-limit.js";
import {
  AdminCreateCategoryDto,
  AdminListQueryDto,
  AdminOfferListQueryDto,
  AdminRequestListQueryDto,
  AdminUpdateCategoryDto,
  AdminUpdateRequestDto,
  AdminUpdateUserDto,
  AdminUserListQueryDto,
} from "./admin.dto.js";
import { AdminService } from "./admin.service.js";

@ApiTags("Admin")
@ApiStandardErrors()
@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Post("auth/login")
  @HttpCode(HttpStatus.OK)
  @CredentialRateLimit()
  @ApiOperation({ summary: "Admin sign-in (admins only)" })
  @ApiOkResponse({ description: "Authenticated admin and token pair" })
  @ApiUnauthorizedResponse({ description: "Invalid credentials or non-admin" })
  async login(@Body() data: LoginDto) {
    return { data: await this.authService.adminLogin(data) };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated admin account" })
  async me(@CurrentUserId() userId: string) {
    return { data: await this.authService.getMe(userId) };
  }

  @Get("dashboard")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Marketplace overview metrics" })
  async dashboard() {
    return { data: await this.adminService.dashboard() };
  }

  @Get("users")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List users" })
  listUsers(@Query() query: AdminUserListQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get("users/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a user" })
  async getUser(@Param("id") id: string) {
    return { data: await this.adminService.getUser(id) };
  }

  @Patch("users/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update user role or disable status" })
  async updateUser(
    @Param("id") id: string,
    @CurrentUserId() adminId: string,
    @Body() data: AdminUpdateUserDto,
  ) {
    return { data: await this.adminService.updateUser(id, adminId, data) };
  }

  @Post("users/:id/revoke-sessions")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke all refresh tokens for a user" })
  async revokeSessions(@Param("id") id: string) {
    return { data: await this.adminService.revokeUserSessions(id) };
  }

  @Delete("users/:id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Permanently delete a user" })
  async deleteUser(@Param("id") id: string, @CurrentUserId() adminId: string) {
    return { data: await this.adminService.deleteUser(id, adminId) };
  }

  @Get("requests")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List service requests" })
  listRequests(@Query() query: AdminRequestListQueryDto) {
    return this.adminService.listRequests(query);
  }

  @Get("requests/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a service request" })
  async getRequest(@Param("id") id: string) {
    return { data: await this.adminService.getRequest(id) };
  }

  @Patch("requests/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Moderate a service request" })
  async updateRequest(@Param("id") id: string, @Body() data: AdminUpdateRequestDto) {
    return { data: await this.adminService.updateRequest(id, data) };
  }

  @Delete("requests/:id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a service request" })
  async deleteRequest(@Param("id") id: string) {
    return { data: await this.adminService.deleteRequest(id) };
  }

  @Get("offers")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List offers" })
  listOffers(@Query() query: AdminOfferListQueryDto) {
    return this.adminService.listOffers(query);
  }

  @Get("reviews")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List reviews" })
  listReviews(@Query() query: AdminListQueryDto) {
    return this.adminService.listReviews(query);
  }

  @Delete("reviews/:id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a review and recalc subject rating" })
  async deleteReview(@Param("id") id: string) {
    return { data: await this.adminService.deleteReview(id) };
  }

  @Get("categories")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List categories with request counts" })
  async listCategories() {
    return { data: await this.adminService.listCategories() };
  }

  @Post("categories")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a category" })
  async createCategory(@Body() data: AdminCreateCategoryDto) {
    return { data: await this.adminService.createCategory(data) };
  }

  @Patch("categories/:id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a category" })
  async updateCategory(@Param("id") id: string, @Body() data: AdminUpdateCategoryDto) {
    return { data: await this.adminService.updateCategory(id, data) };
  }

  @Delete("categories/:id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete an unused category" })
  async deleteCategory(@Param("id") id: string) {
    return { data: await this.adminService.deleteCategory(id) };
  }
}
