import { Global, Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway.js";
import { RealtimePresenceService } from "./realtime.presence.service.js";
import { RealtimePublisher } from "./realtime.publisher.js";

@Global()
@Module({
  providers: [RealtimeGateway, RealtimePublisher, RealtimePresenceService],
  exports: [RealtimePublisher, RealtimePresenceService],
})
export class RealtimeModule {}
