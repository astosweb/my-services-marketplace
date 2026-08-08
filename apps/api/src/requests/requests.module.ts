import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module.js";
import { RequestsController } from "./requests.controller.js";
import { RequestsService } from "./requests.service.js";

@Module({
  imports: [PushModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
