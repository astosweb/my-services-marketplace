import { NextResponse } from "next/server";
import { nestFetch, NestRequestError } from "@/lib/api/nest";
import { assertSameOriginMutation } from "@/lib/auth/csrf";

export async function POST(request: Request) {
  const csrf = assertSameOriginMutation(request);
  if (csrf) return csrf;

  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    await nestFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: body.token,
        password: body.password,
      }),
      skipAuth: true,
    });
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    if (error instanceof NestRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Reset failed" },
      { status: 500 },
    );
  }
}
