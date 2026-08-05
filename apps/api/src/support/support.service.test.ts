import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationKind,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  UserRole,
} from "../generated/prisma/client.js";
import { SupportService } from "./support.service.js";

function createPrismaMock() {
  return {
    supportCaseSequence: {
      upsert: vi.fn(),
    },
    supportTicket: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    supportMessage: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    supportAttachment: {
      createMany: vi.fn(),
    },
    supportActivity: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    supportStatusHistory: {
      create: vi.fn(),
    },
    supportInternalNote: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    supportCannedResponse: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    deviceToken: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe("SupportService", () => {
  const prisma = createPrismaMock();
  const pushService = {
    notifyUsers: vi.fn().mockResolvedValue({ notifiedUsers: 1, pushAttempted: 0, pushDelivered: 0 }),
  };
  const emailService = {
    sendSupportNotification: vi.fn().mockResolvedValue(undefined),
  };
  let service: SupportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SupportService(
      prisma as never,
      pushService as never,
      emailService as never,
    );
  });

  it("creates a ticket with case number and notifies admins", async () => {
    const createdAt = new Date("2026-08-04T12:00:00.000Z");
    const ticket = {
      id: "ticket-1",
      caseNumber: "SUP-20260804-000001",
      subject: "Payment failed",
      description: "I was charged twice for premium.",
      category: SupportTicketCategory.PAYMENT,
      priority: SupportTicketPriority.HIGH,
      status: SupportTicketStatus.OPEN,
      tags: [],
      mergedIntoId: null,
      firstResponseAt: null,
      responseDueAt: new Date("2026-08-04T16:00:00.000Z"),
      resolveDueAt: new Date("2026-08-05T12:00:00.000Z"),
      resolvedAt: null,
      closedAt: null,
      lastMessageAt: createdAt,
      userLastReadAt: createdAt,
      adminLastReadAt: null,
      unreadByUser: 0,
      unreadByAdmin: 1,
      appVersion: "1.0.0",
      platform: "ios",
      deviceName: "iPhone",
      systemVersion: "18.0",
      userAgent: "Bidy/1.0",
      createdAt,
      updatedAt: createdAt,
      createdById: "user-1",
      assignedAdminId: null,
      createdBy: {
        id: "user-1",
        email: "user@example.com",
        displayName: "User",
        businessName: null,
        preferBusinessName: true,
        avatarKey: null,
        role: UserRole.USER,
        status: "ACTIVE",
        createdAt,
      },
      assignedAdmin: null,
      _count: { attachments: 0, messages: 1 },
    };

    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => {
      prisma.supportCaseSequence.upsert.mockResolvedValue({ dateKey: "20260804", lastValue: 1 });
      prisma.supportTicket.create.mockResolvedValue(ticket);
      prisma.supportMessage.findFirst.mockResolvedValue({ id: "msg-1" });
      prisma.supportTicket.findUniqueOrThrow.mockResolvedValue(ticket);
      return fn(prisma);
    });
    prisma.user.findMany.mockResolvedValue([{ id: "admin-1", email: "admin@example.com" }]);

    const result = await service.createTicket("user-1", {
      subject: "Payment failed",
      description: "I was charged twice for premium.",
      category: SupportTicketCategory.PAYMENT,
      priority: SupportTicketPriority.HIGH,
      appVersion: "1.0.0",
      platform: "ios",
    });

    expect(result.caseNumber).toBe("SUP-20260804-000001");
    expect(result.status).toBe("OPEN");
    expect(result.priority).toBe("HIGH");
    expect(pushService.notifyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ["admin-1"],
        kind: NotificationKind.SUPPORT_TICKET_CREATED,
      }),
    );
    expect(emailService.sendSupportNotification).toHaveBeenCalled();
  });

  it("rejects empty message replies", async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({
      id: "ticket-1",
      mergedIntoId: null,
      createdById: "user-1",
      status: SupportTicketStatus.OPEN,
      createdBy: { email: "user@example.com" },
      messages: [],
      attachments: [],
      internalNotes: [],
      statusHistory: [],
      activities: [],
      assignedAdmin: null,
    });

    await expect(
      service.sendMessage("ticket-1", { userId: "user-1", isAdmin: false }, {}),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("tracks typing indicators with expiry", async () => {
    await service.setTyping("ticket-1", { userId: "u1", displayName: "Ada" }, true);
    expect((await service.getTyping("ticket-1", "admin")).typers).toEqual([
      { userId: "u1", displayName: "Ada" },
    ]);
    await service.setTyping("ticket-1", { userId: "u1", displayName: "Ada" }, false);
    expect((await service.getTyping("ticket-1")).typers).toEqual([]);
  });
});
