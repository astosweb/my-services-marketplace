import { Global, Module } from "@nestjs/common";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { AdminGuard } from "./guards/admin.guard.js";
import { RateLimitGuard } from "../middleware/rate-limit.js";

@Global()
@Module({
  providers: [JwtAuthGuard, OptionalJwtAuthGuard, AdminGuard, RateLimitGuard],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard, AdminGuard, RateLimitGuard],
})
export class CommonModule {}
