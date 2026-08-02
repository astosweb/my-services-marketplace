import type { Request } from "express";
import { clientIp } from "../middleware/rate-limit.js";

export type RequestClientMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

export function requestClientMeta(request: Request): RequestClientMeta {
  const ip = clientIp(request);
  const ua = request.header("user-agent")?.trim();
  return {
    ipAddress: !ip || ip === "unknown" ? null : ip.slice(0, 64),
    userAgent: ua ? ua.slice(0, 512) : null,
  };
}
