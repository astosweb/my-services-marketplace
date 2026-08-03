import { readFileSync } from "node:fs";
import { connect, type ClientHttp2Session } from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import { Logger } from "@nestjs/common";
import { env } from "../lib/env.js";

export type ApnsSendResult =
  | { ok: true; apnsId: string | null }
  | { ok: false; status: number; reason: string; shouldInvalidateToken: boolean };

const INVALID_TOKEN_REASONS = new Set([
  "BadDeviceToken",
  "Unregistered",
  "ExpiredToken",
  "DeviceTokenNotForTopic",
]);

type ApnsPrivateKey = Awaited<ReturnType<typeof importPKCS8>>;

export class ApnsClient {
  private readonly logger = new Logger(ApnsClient.name);
  private privateKey: ApnsPrivateKey | null = null;
  private jwt: string | null = null;
  private jwtExpiresAt = 0;
  private session: ClientHttp2Session | null = null;

  isConfigured() {
    return Boolean(env.APNS_KEY_ID && env.APNS_TEAM_ID && this.resolvePrivateKeyPem());
  }

  async send(deviceToken: string, payload: Record<string, unknown>): Promise<ApnsSendResult> {
    if (!this.isConfigured()) {
      return { ok: false, status: 0, reason: "APNs not configured", shouldInvalidateToken: false };
    }

    const host = env.APNS_PRODUCTION ? "api.push.apple.com" : "api.sandbox.push.apple.com";
    const authorization = await this.getAuthorizationHeader();
    const session = this.getSession(host);
    const body = JSON.stringify(payload);

    return new Promise((resolve) => {
      const request = session.request({
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${authorization}`,
        "apns-topic": env.APNS_BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      });

      let responseStatus = 0;
      let apnsId: string | null = null;
      const chunks: Buffer[] = [];

      request.on("response", (headers) => {
        responseStatus = Number(headers[":status"] ?? 0);
        const id = headers["apns-id"];
        apnsId = typeof id === "string" ? id : null;
      });
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("error", (error: Error) => {
        this.logger.warn(`APNs request error: ${error.message}`);
        resolve({
          ok: false,
          status: 0,
          reason: error.message,
          shouldInvalidateToken: false,
        });
      });
      request.on("end", () => {
        if (responseStatus === 200) {
          resolve({ ok: true, apnsId });
          return;
        }
        let reason = "Unknown";
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { reason?: string };
          reason = parsed.reason ?? reason;
        } catch {
          // ignore parse errors
        }
        resolve({
          ok: false,
          status: responseStatus,
          reason,
          shouldInvalidateToken: INVALID_TOKEN_REASONS.has(reason) || responseStatus === 410,
        });
      });
      request.end(body);
    });
  }

  close() {
    if (this.session && !this.session.closed) {
      this.session.close();
    }
    this.session = null;
  }

  private getSession(host: string) {
    if (this.session && !this.session.closed && !this.session.destroyed) {
      return this.session;
    }
    this.session = connect(`https://${host}`);
    this.session.on("error", (error) => {
      this.logger.warn(`APNs session error: ${error.message}`);
      this.session = null;
    });
    return this.session;
  }

  private async getAuthorizationHeader() {
    const now = Math.floor(Date.now() / 1000);
    if (this.jwt && now < this.jwtExpiresAt - 60) return this.jwt;

    const key = await this.getPrivateKey();
    this.jwt = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: env.APNS_KEY_ID! })
      .setIssuer(env.APNS_TEAM_ID!)
      .setIssuedAt(now)
      .sign(key);
    this.jwtExpiresAt = now + 50 * 60;
    return this.jwt;
  }

  private async getPrivateKey() {
    if (this.privateKey) return this.privateKey;
    const pem = this.resolvePrivateKeyPem();
    if (!pem) throw new Error("APNs private key is not configured");
    this.privateKey = await importPKCS8(pem, "ES256");
    return this.privateKey;
  }

  private resolvePrivateKeyPem() {
    if (env.APNS_PRIVATE_KEY?.trim()) {
      return env.APNS_PRIVATE_KEY.replace(/\\n/g, "\n").trim();
    }
    if (env.APNS_PRIVATE_KEY_PATH?.trim()) {
      try {
        return readFileSync(env.APNS_PRIVATE_KEY_PATH, "utf8").trim();
      } catch (error) {
        this.logger.warn(
          `Failed to read APNS_PRIVATE_KEY_PATH: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
    }
    return null;
  }
}
