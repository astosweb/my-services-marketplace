import { IoAdapter } from "@nestjs/platform-socket.io";
import { Logger, type INestApplication } from "@nestjs/common";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient, type RedisClientType } from "redis";
import type { ServerOptions } from "socket.io";
import { corsOrigins, env } from "../lib/env.js";

/**
 * Socket.IO adapter that attaches the Redis pub/sub adapter when REDIS_URL is set,
 * enabling room broadcasts across horizontally scaled API instances.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis() {
    if (!env.REDIS_URL) {
      this.logger.warn("REDIS_URL unset — Socket.IO runs in single-node mode");
      return;
    }
    try {
      this.pubClient = createClient({ url: env.REDIS_URL }) as RedisClientType;
      this.subClient = this.pubClient.duplicate();
      this.pubClient.on("error", (error) =>
        this.logger.error(`Socket.IO Redis pub error: ${String(error)}`),
      );
      this.subClient.on("error", (error) =>
        this.logger.error(`Socket.IO Redis sub error: ${String(error)}`),
      );
      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      this.adapterConstructor = createAdapter(this.pubClient, this.subClient, {
        key: "gobid:socket.io",
      });
      this.logger.log("Socket.IO Redis adapter connected");
    } catch (error) {
      this.logger.error(`Failed to connect Socket.IO Redis adapter: ${String(error)}`);
      this.adapterConstructor = null;
    }
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const origins = corsOrigins();
    const server = super.createIOServer(port, {
      ...options,
      transports: ["websocket", "polling"],
      cors: {
        origin: origins === "*" ? true : origins,
        credentials: true,
      },
      connectTimeout: 20_000,
      pingInterval: 25_000,
      pingTimeout: 20_000,
      maxHttpBufferSize: 1e5,
      allowEIO3: false,
    });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  async disconnectRedis() {
    await Promise.all([
      this.pubClient?.quit().catch(() => undefined),
      this.subClient?.quit().catch(() => undefined),
    ]);
  }
}
