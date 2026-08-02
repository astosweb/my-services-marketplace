import { Module } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { PushModule } from "../push/push.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [PushModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
  exports: [AdminService],
})
export class AdminModule {}
