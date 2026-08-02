import { Module } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
  exports: [AdminService],
})
export class AdminModule {}
