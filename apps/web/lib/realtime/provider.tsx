"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  conversationRoom,
  RealtimeServerEvent,
  requestRoom,
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

type EnvelopeHandler = (envelope: RealtimeEnvelope) => void;

type RealtimeContextValue = {
  connected: boolean;
  joinConversation: (id: string) => void;
  leaveConversation: (id: string) => void;
  joinRequest: (id: string) => void;
  leaveRequest: (id: string) => void;
  joinSupport: (id: string) => void;
  leaveSupport: (id: string) => void;
  setTyping: (room: string, isTyping: boolean) => void;
  markRead: (conversationId: string) => void;
  markDelivered: (conversationId: string, messageId: string) => void;
  subscribe: (event: string, handler: EnvelopeHandler) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  joinConversation: () => undefined,
  leaveConversation: () => undefined,
  joinRequest: () => undefined,
  leaveRequest: () => undefined,
  joinSupport: () => undefined,
  leaveSupport: () => undefined,
  setTyping: () => undefined,
  markRead: () => undefined,
  markDelivered: () => undefined,
  subscribe: () => () => undefined,
});

async function fetchSocketToken(): Promise<SocketTokenResponse> {
  const response = await fetch("/api/auth/socket-token", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch socket token");
  }
  const payload = (await response.json()) as {
    success?: boolean;
    data?: SocketTokenResponse;
  };
  if (!payload.data?.token) throw new Error("Socket token missing");
  return payload.data;
}

function invalidateForEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  envelope: RealtimeEnvelope,
) {
  const data = envelope.data;
  const conversationId =
    typeof data.conversationId === "string" ? data.conversationId : undefined;
  const requestId = typeof data.requestId === "string" ? data.requestId : undefined;
  const ticketId = typeof data.ticketId === "string" ? data.ticketId : undefined;

  switch (envelope.event) {
    case RealtimeServerEvent.MESSAGE_CREATED:
    case RealtimeServerEvent.MESSAGE_READ:
    case RealtimeServerEvent.MESSAGE_DELIVERED:
    case RealtimeServerEvent.CONVERSATION_UPDATED:
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (conversationId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.messages(conversationId),
        });
      }
      break;
    case RealtimeServerEvent.UNREAD_UPDATED:
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["support"] });
      break;
    case RealtimeServerEvent.NOTIFICATION_CREATED:
    case RealtimeServerEvent.NOTIFICATION_UPDATED:
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      break;
    case RealtimeServerEvent.OFFER_CREATED:
    case RealtimeServerEvent.OFFER_UPDATED:
    case RealtimeServerEvent.REQUEST_UPDATED:
    case RealtimeServerEvent.REQUEST_MODERATION:
    case RealtimeServerEvent.REQUEST_CREATED:
    case RealtimeServerEvent.JOB_PROGRESS:
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      if (requestId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId) });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.requestOffers(requestId),
        });
      }
      break;
    case RealtimeServerEvent.SUPPORT_TICKET_UPDATED:
    case RealtimeServerEvent.SUPPORT_MESSAGE_CREATED:
      void queryClient.invalidateQueries({ queryKey: ["support"] });
      if (ticketId) {
        void queryClient.invalidateQueries({
          queryKey: ["support", "tickets", ticketId],
        });
      }
      break;
    default:
      break;
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const queryClient = useQueryClient();
  const clientRef = useRef<RealtimeClient | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const connected = Boolean(userId) && socketReady;

  const onEnvelope = useEffectEvent((envelope: RealtimeEnvelope) => {
    invalidateForEvent(queryClient, envelope);
  });

  useEffect(() => {
    if (!userId) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      return;
    }

    const client = new RealtimeClient(fetchSocketToken);
    clientRef.current = client;

    const unsubscribers = LIVE_QUERY_EVENTS.map((event) =>
      client.on(event, onEnvelope),
    );
    unsubscribers.push(
      client.on(RealtimeServerEvent.READY, () => {
        setSocketReady(true);
        client.pingPresence();
      }),
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
      setSocketReady(false);
    };
  }, [userId]);

  const joinConversation = useCallback((id: string) => {
    clientRef.current?.join(conversationRoom(id));
  }, []);
  const leaveConversation = useCallback((id: string) => {
    clientRef.current?.leave(conversationRoom(id));
  }, []);
  const joinRequest = useCallback((id: string) => {
    clientRef.current?.join(requestRoom(id));
  }, []);
  const leaveRequest = useCallback((id: string) => {
    clientRef.current?.leave(requestRoom(id));
  }, []);
  const joinSupport = useCallback((id: string) => {
    clientRef.current?.join(supportRoom(id));
  }, []);
  const leaveSupport = useCallback((id: string) => {
    clientRef.current?.leave(supportRoom(id));
  }, []);
  const setTyping = useCallback((room: string, isTyping: boolean) => {
    clientRef.current?.setTyping(room, isTyping);
  }, []);
  const markRead = useCallback((conversationId: string) => {
    clientRef.current?.markRead(conversationId);
  }, []);
  const markDelivered = useCallback(
    (conversationId: string, messageId: string) => {
      clientRef.current?.markDelivered(conversationId, messageId);
    },
    [],
  );
  const subscribe = useCallback((event: string, handler: EnvelopeHandler) => {
    const client = clientRef.current;
    if (!client) return () => undefined;
    return client.on(event, handler);
  }, []);

  const value = useMemo(
    () => ({
      connected,
      joinConversation,
      leaveConversation,
      joinRequest,
      leaveRequest,
      joinSupport,
      leaveSupport,
      setTyping,
      markRead,
      markDelivered,
      subscribe,
    }),
    [
      connected,
      joinConversation,
      leaveConversation,
      joinRequest,
      leaveRequest,
      joinSupport,
      leaveSupport,
      setTyping,
      markRead,
      markDelivered,
      subscribe,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
