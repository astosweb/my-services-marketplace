import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace.js";
import { prisma } from "./prisma.js";

export type AuditAction =
  | "user.registered"
  | "user.login"
  | "user.login_failed"
  | "user.logout"
  | "user.password_reset_requested"
  | "user.password_reset_completed"
  | "user.profile_updated"
  | "user.deleted"
  | "request.created"
  | "request.updated"
  | "request.cancelled"
  | "request.completed"
  | "request.progress_updated"
  | "offer.created"
  | "offer.accepted"
  | "offer.declined"
  | "offer.withdrawn"
  | "review.created"
  | "conversation.created"
  | "message.sent"
  | "device.registered"
  | "device.removed";

interface AuditLogEntry {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, InputJsonValue | undefined>;
  ipAddress?: string;
  userAgent?: string;
}

export function logAudit(entry: AuditLogEntry): void {
  prisma.auditLog
    .create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    })
    .catch((err) => {
      console.error("[audit-log] Failed to write audit log:", err);
    });
}
