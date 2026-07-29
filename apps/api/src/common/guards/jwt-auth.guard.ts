import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { unauthorized } from "../../lib/errors.js";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser>(error: unknown, user: TUser): TUser {
    if (error || !user) throw unauthorized("Authentication required");
    return user;
  }
}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser>(_error: unknown, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
