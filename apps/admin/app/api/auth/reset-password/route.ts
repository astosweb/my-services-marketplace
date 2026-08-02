import { NextResponse } from "next/server";
import { nestFetch, NestRequestError } from "@/lib/api/nest";

export async function POST(request: Request) {
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
    const result = await nestFetch<{ data: { ok: true } }>(
      "/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: body.token,
          password: body.password,
        }),
        skipAuth: true,
      },
    );
    return NextResponse.json({ success: true, data: result.data });
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
