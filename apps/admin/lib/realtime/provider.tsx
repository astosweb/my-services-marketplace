"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  RealtimeServerEvent,
  supportRoom,
  type RealtimeEnvelope,
} from "@monorepo/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/hooks/use-session";
import { queryKeys } from "@/lib/api/keys";
import { LIVE_QUERY_EVENTS, RealtimeClient, type SocketTokenResponse } from "./client";

type RealtimeContextValue = {
  connected: boolean;
  joinSupport: (id: string) => void;
  leaveSupport: (id: string) => void;
  setTyping: (room: string, isTyping: boolean) => void;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  joinSupport: () => undefined,
  leaveSupport: () => undefined,
  setTyping: () => undefined,
});

async function fetchSocketToken(): Promise<SocketTokenResponse> {
  const response = await fetch("/api/auth/socket-token", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Failed to fetch socket token");
  const payload = (await response.json()) as {
    data?: SocketTokenResponse;
  };
  if (!payload.data?.token) throw new Error("Socket token missing");
  return payload.data;
}

function invalidateForEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  envelope: RealtimeEnvelope,
) {
  const ticketId =
    typeof envelope.data.ticketId === "string" ? envelope.data.ticketId : undefined;

  switch (envelope.event) {
    case RealtimeServerEvent.NOTIFICATION_CREATED:
    case RealtimeServerEvent.NOTIFICATION_UPDATED:
    case RealtimeServerEvent.UNREAD_UPDATED:
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      break;
    case RealtimeServerEvent.REQUEST_MODERATION:
    case RealtimeServerEvent.ADMIN_MODERATION:
    case RealtimeServerEvent.REQUEST_CREATED:
    case RealtimeServerEvent.REQUEST_UPDATED:
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      break;
    case RealtimeServerEvent.OFFER_CREATED:
    case RealtimeServerEvent.OFFER_UPDATED:
      void queryClient.invalidateQueries({ queryKey: queryKeys.offers() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests() });
      break;
    case RealtimeServerEvent.SUPPORT_TICKET_UPDATED:
    case RealtimeServerEvent.SUPPORT_MESSAGE_CREATED:
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportTickets() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportStats });
      if (ticketId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.supportTicket(ticketId),
        });
      }
      break;
    case RealtimeServerEvent.SUPPORT_TYPING:
      // UI-only; do not refetch tickets on typing heartbeats.
      break;
    case RealtimeServerEvent.ADMIN_STATS:
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.systemStatus });
      break;
    case RealtimeServerEvent.CONVERSATION_UPDATED:
    case RealtimeServerEvent.MESSAGE_CREATED:
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations() });
      break;
    default:
      break;
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const clientRef = useRef<RealtimeClient | null>(null);
  const [connected, setConnected] = useState(false);

  const onEnvelope = useEffectEvent((envelope: RealtimeEnvelope) => {
    invalidateForEvent(queryClient, envelope);
  });

  useEffect(() => {
    if (!userId) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      setConnected(false);
      return;
    }

    const client = new RealtimeClient(fetchSocketToken);
    clientRef.current = client;

    const unsubscribers = LIVE_QUERY_EVENTS.map((event) =>
      client.on(event, onEnvelope),
    );
    unsubscribers.push(
      client.on(RealtimeServerEvent.READY, () => {
        setConnected(true);
        client.pingPresence();
      }),
      client.on(RealtimeServerEvent.SUPPORT_TYPING, onEnvelope),
    );

    let presenceTimer: ReturnType<typeof setInterval> | undefined;
    void client.connect().then(() => {
      presenceTimer = setInterval(() => client.pingPresence(), 45_000);
    });

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      if (presenceTimer) clearInterval(presenceTimer);
      client.disconnect();
      if (clientRef.current === client) clientRef.current = null;
      setConnected(false);
    };
  }, [userId]);

  const joinSupport = useCallback((id: string) => {
    clientRef.current?.join(supportRoom(id));
  }, []);
  const leaveSupport = useCallback((id: string) => {
    clientRef.current?.leave(supportRoom(id));
  }, []);
  const setTyping = useCallback((room: string, isTyping: boolean) => {
    clientRef.current?.setTyping(room, isTyping);
  }, []);

  const value = useMemo(
    () => ({ connected, joinSupport, leaveSupport, setTyping }),
    [connected, joinSupport, leaveSupport, setTyping],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
