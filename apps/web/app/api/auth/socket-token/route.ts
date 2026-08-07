import { NextResponse } from "next/server";
import {
  nestFetch,
  NestRequestError,
  getAccessToken,
  getRefreshToken,
} from "@/lib/api/nest";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/token-cookies";

type NestRefreshPayload = {
  data: {
    accessToken: string;
    refreshToken: string;
  };
};

async function ensureAccessToken(): Promise<string | null> {
  const existing = await getAccessToken();
  if (existing) return existing;

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const result = await nestFetch<NestRefreshPayload>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });
    await setAuthCookies({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });
    return result.data.accessToken;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

/** Returns the HttpOnly access JWT for Socket.IO handshake (never logged). */
export async function GET() {
  try {
    let accessToken = await ensureAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Validate token is still accepted by Nest (also refreshes if needed).
    try {
      await nestFetch("/auth/socket-token", { accessToken });
    } catch (error) {
      if (error instanceof NestRequestError && error.status === 401) {
        accessToken = await ensureAccessToken();
        if (!accessToken) {
          return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 },
          );
        }
      } else if (error instanceof NestRequestError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status },
        );
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        token: accessToken,
        namespace: "/realtime",
        protocolVersion: 1,
        url: process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3000",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Socket token unavailable" },
      { status: 500 },
    );
  }
}
