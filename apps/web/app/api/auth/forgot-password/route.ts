import { NextResponse } from "next/server";
import { nestFetch, NestRequestError } from "@/lib/api/nest";
import { assertSameOriginMutation } from "@/lib/auth/csrf";

export async function POST(request: Request) {
  const csrf = assertSameOriginMutation(request);
  if (csrf) return csrf;

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const result = await nestFetch<{
      data: { message: string; token?: string; resetLink?: string };
    }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: body.email }),
      skipAuth: true,
    });
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof NestRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Request failed" },
      { status: 500 },
    );
  }
}
