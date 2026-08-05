import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { unauthorized } from "../../lib/errors.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(error: unknown, user: TUser): TUser {
    if (error || !user) throw unauthorized("Authentication required");
    return user;
  }
}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  override handleRequest<TUser>(_error: unknown, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
