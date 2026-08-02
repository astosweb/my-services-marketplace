import { NextResponse } from "next/server";
import { nestFetch, getRefreshToken } from "@/lib/api/nest";
import { clearAuthCookies } from "@/lib/auth/token-cookies";

export async function POST() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await nestFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        skipAuth: true,
      });
    } catch {
      // Always clear local cookies even if Nest revoke fails
    }
  }
  await clearAuthCookies();
  return NextResponse.json({ success: true, data: { ok: true } });
}
