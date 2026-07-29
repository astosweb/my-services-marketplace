import { Global, Module } from "@nestjs/common";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { RateLimitGuard } from "../middleware/rate-limit.js";

@Global()
@Module({
  providers: [JwtAuthGuard, OptionalJwtAuthGuard, RateLimitGuard],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard, RateLimitGuard],
})
export class CommonModule {}
