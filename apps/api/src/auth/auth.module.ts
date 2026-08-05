import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { EmailModule } from "../email/email.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { UsersModule } from "../users/users.module.js";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    EmailModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
