import { NextResponse } from "next/server";
import { nestFetch, NestRequestError } from "@/lib/api/nest";
import { setAuthCookies } from "@/lib/auth/token-cookies";
import type { AuthTokensResponse } from "@monorepo/shared";
import { assertSameOriginMutation } from "@/lib/auth/csrf";

export async function POST(request: Request) {
  const csrf = assertSameOriginMutation(request);
  if (csrf) return csrf;

  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const result = await nestFetch<{ data: AuthTokensResponse }>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email: body.email,
          password: body.password,
          displayName: body.displayName,
        }),
        skipAuth: true,
      },
    );

    await setAuthCookies({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });

    return NextResponse.json({
      success: true,
      data: { user: result.data.user },
    });
  } catch (error) {
    if (error instanceof NestRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Registration failed" },
      { status: 500 },
    );
  }
}
