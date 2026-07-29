import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { CredentialRateLimit, RefreshRateLimit } from "../middleware/rate-limit.js";
import {
  DeleteAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from "./auth.dto.js";
import { AuthService } from "./auth.service.js";

import { UsersService } from "../users/users.service.js";

@ApiTags("Authentication")
@ApiStandardErrors()
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post("register")
  @CredentialRateLimit()
  @ApiOperation({ summary: "Create an account" })
  @ApiCreatedResponse({ description: "Account and token pair created" })
  async register(@Body() data: RegisterDto) {
    return { data: await this.authService.register(data) };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @CredentialRateLimit()
  @ApiOperation({ summary: "Sign in" })
  @ApiOkResponse({ description: "Authenticated account and token pair" })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  async login(@Body() data: LoginDto) {
    return { data: await this.authService.login(data) };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @RefreshRateLimit()
  @ApiOperation({ summary: "Rotate a refresh token" })
  async refresh(@Body() data: RefreshTokenDto) {
    return { data: await this.authService.refresh(data) };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke a refresh token" })
  async logout(@Body() data: RefreshTokenDto) {
    return { data: await this.authService.logout(data) };
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @CredentialRateLimit()
  @ApiOperation({ summary: "Create a password reset token" })
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    return { data: await this.authService.forgotPassword(data) };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset a password" })
  async resetPassword(@Body() data: ResetPasswordDto) {
    return { data: await this.authService.resetPassword(data) };
  }

  @Get("me/stats")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get account activity counts" })
  async getStats(@CurrentUserId() userId: string) {
    return { data: await this.authService.getStats(userId) };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated account" })
  async getMe(@CurrentUserId() userId: string) {
    return { data: await this.authService.getMe(userId) };
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update the authenticated account" })
  async updateMe(@CurrentUserId() userId: string, @Body() data: UpdateProfileDto) {
    return { data: await this.usersService.update(userId, userId, data) };
  }

  @Delete("me")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Permanently delete the authenticated account" })
  @ApiNoContentResponse()
  async deleteMe(@CurrentUserId() userId: string, @Body() data: DeleteAccountDto) {
    await this.authService.deleteMe(userId, data);
  }
}
