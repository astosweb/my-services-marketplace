import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module.js";
import { PushModule } from "../push/push.module.js";
import { AdminSupportController } from "./admin-support.controller.js";
import { SupportController } from "./support.controller.js";
import { SupportService } from "./support.service.js";

@Module({
  imports: [PushModule, EmailModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
