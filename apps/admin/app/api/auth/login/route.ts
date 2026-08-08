import { NextResponse } from "next/server";
import { nestFetch, NestRequestError } from "@/lib/api/nest";
import { setAuthCookies } from "@/lib/auth/token-cookies";
import { assertSameOriginMutation } from "@/lib/auth/csrf";

type NestAuthPayload = {
  data: {
    user: {
      id: string;
      email: string;
      displayName: string;
      role?: string;
      permissions?: string[];
    };
    accessToken: string;
    refreshToken: string;
  };
};

export async function POST(request: Request) {
  const csrf = assertSameOriginMutation(request);
  if (csrf) return csrf;

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const result = await nestFetch<NestAuthPayload>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
      skipAuth: true,
    });

    const role = result.data.user.role;
    if (role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Admin access required. This account is not an administrator.",
        },
        { status: 403 },
      );
    }

    await setAuthCookies({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });

    return NextResponse.json({
      success: true,
      data: {
        user: result.data.user,
        permissions: result.data.user.permissions ?? [],
      },
    });
  } catch (error) {
    if (error instanceof NestRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 },
    );
  }
}
