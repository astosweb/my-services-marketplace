import { describe, expect, it, vi } from "vitest";
import { RealtimePublisher } from "./realtime.publisher.js";
import { RealtimeServerEvent, userRoom } from "./realtime.constants.js";

describe("RealtimePublisher", () => {
  it("emits versioned envelopes to user rooms", () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const publisher = new RealtimePublisher();
    publisher.attachServer({ to } as never);

    publisher.emitToUser("user-1", RealtimeServerEvent.UNREAD_UPDATED, {
      conversationsUnread: 2,
    });

    expect(to).toHaveBeenCalledWith(userRoom("user-1"));
    expect(emit).toHaveBeenCalledWith(
      RealtimeServerEvent.UNREAD_UPDATED,
      expect.objectContaining({
        v: 1,
        event: RealtimeServerEvent.UNREAD_UPDATED,
        data: { conversationsUnread: 2 },
      }),
    );
  });

  it("drops events when server is not attached", () => {
    const publisher = new RealtimePublisher();
    expect(() =>
      publisher.emitToUser("user-1", RealtimeServerEvent.NOTIFICATION_CREATED, {
        notification: { id: "n1" },
      }),
    ).not.toThrow();
  });
});
