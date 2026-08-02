import { Injectable } from "@nestjs/common";
import { OfferStatus, ServiceRequestStatus, type User } from "../generated/prisma/client.js";
import { permissionsForRole } from "../lib/admin-permissions.js";
import {
  createPasswordResetToken,
  createRefreshTokenValue,
  hashPassword,
  hashPasswordResetToken,
  hashRefreshToken,
  passwordResetTokenExpiresAt,
  refreshTokenExpiresAt,
  signAccessToken,
  verifyPassword,
} from "../lib/auth.js";
import { env } from "../lib/env.js";
import { conflict, notFound, unauthorized } from "../lib/errors.js";
import { serializeMe } from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  DeleteAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from "./auth.dto.js";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private async issueTokens(userId: string) {
    const refreshToken = createRefreshTokenValue();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt(),
      },
    });
    return { accessToken: await signAccessToken(userId), refreshToken };
  }

  private authPayload(user: User, tokens: { accessToken: string; refreshToken: string }) {
    return {
      user: { ...serializeMe(user), permissions: permissionsForRole(user.role) },
      ...tokens,
    };
  }

  async register(data: RegisterDto) {
    const email = data.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw conflict("Email already registered");
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: data.displayName,
        passwordHash: await hashPassword(data.password),
      },
    });
    return this.authPayload(user, await this.issueTokens(user.id));
  }

  async login(data: LoginDto) {
    const email = data.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await verifyPassword(data.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    return this.authPayload(user, await this.issueTokens(user.id));
  }

  async refresh(data: RefreshTokenDto) {
    const tokenHash = hashRefreshToken(data.refreshToken);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!stored) throw unauthorized("Invalid or expired refresh token");
      if (stored.expiresAt < new Date()) {
        await transaction.refreshToken.deleteMany({ where: { id: stored.id } });
        throw unauthorized("Invalid or expired refresh token");
      }
      const removed = await transaction.refreshToken.deleteMany({ where: { id: stored.id } });
      if (removed.count !== 1) {
        await transaction.refreshToken.deleteMany({ where: { userId: stored.userId } });
        throw unauthorized("Refresh token reuse detected");
      }
      const refreshToken = createRefreshTokenValue();
      await transaction.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: refreshTokenExpiresAt(),
        },
      });
      return {
        user: stored.user,
        refreshToken,
        accessToken: await signAccessToken(stored.userId),
      };
    });
    return this.authPayload(rotated.user, rotated);
  }

  async logout(data: RefreshTokenDto) {
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash: hashRefreshToken(data.refreshToken) },
    });
    return { ok: true };
  }

  async forgotPassword(data: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    const response: { message: string; token?: string; resetLink?: string } = {
      message: "If an account exists for that email, a password reset link has been created.",
    };
    if (!user?.passwordHash) return response;

    const token = createPasswordResetToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashPasswordResetToken(token),
          expiresAt: passwordResetTokenExpiresAt(),
        },
      }),
    ]);
    if (env.NODE_ENV !== "production") {
      const resetUrl = new URL(env.PASSWORD_RESET_URL);
      resetUrl.searchParams.set("token", token);
      response.token = token;
      response.resetLink = resetUrl.toString();
    }
    return response;
  }

  async resetPassword(data: ResetPasswordDto) {
    const tokenHash = hashPasswordResetToken(data.token);
    const passwordHash = await hashPassword(data.password);
    await this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!stored) throw unauthorized("Invalid or expired password reset token");
      const consumed = await transaction.passwordResetToken.deleteMany({
        where: { id: stored.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) {
        throw unauthorized("Invalid or expired password reset token");
      }
      await transaction.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      });
      await transaction.refreshToken.deleteMany({ where: { userId: stored.userId } });
      await transaction.passwordResetToken.deleteMany({ where: { userId: stored.userId } });
    });
    return { ok: true };
  }

  async getStats(userId: string) {
    const [postedCount, completedCount, user] = await Promise.all([
      this.prisma.serviceRequest.count({ where: { ownerId: userId } }),
      this.prisma.serviceRequest.count({
        where: {
          status: ServiceRequestStatus.COMPLETED,
          OR: [
            { ownerId: userId },
            { offers: { some: { offererId: userId, status: OfferStatus.ACCEPTED } } },
          ],
        },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { reviewCount: true } }),
    ]);
    if (!user) throw notFound("User not found");
    return { postedCount, completedCount, reviewCount: user.reviewCount };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound("User not found");
    return { ...serializeMe(user), permissions: permissionsForRole(user.role) };
  }



  async deleteMe(userId: string, data: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !(await verifyPassword(data.password, user.passwordHash))) {
      throw unauthorized("Invalid password");
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
