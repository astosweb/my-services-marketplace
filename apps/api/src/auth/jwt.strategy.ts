import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UserStatus } from "../generated/prisma/client.js";
import { env } from "../lib/env.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
      algorithms: ["HS256"],
    });
  }

  async validate(payload: { sub?: unknown }) {
    if (typeof payload.sub !== "string") return false;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });
    if (!user || user.status === UserStatus.BANNED) return false;
    return { id: user.id };
  }
}
