"use server";

import { redirect } from "next/navigation";
import { nestFetch, NestRequestError } from "@/lib/api/nest";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/token-cookies";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "@/lib/validations";

export type AuthActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

function fieldErrors(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, errors: fieldErrors(parsed.error) };
  }

  try {
    const result = await nestFetch<{
      data: {
        user: { role?: string };
        accessToken: string;
        refreshToken: string;
      };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(parsed.data),
      skipAuth: true,
    });

    if (result.data.user.role !== "ADMIN") {
      return {
        success: false,
        message: "Admin access required. This account is not an administrator.",
      };
    }

    await setAuthCookies({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });
  } catch (error) {
    if (error instanceof NestRequestError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Login failed" };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  try {
    const { getRefreshToken } = await import("@/lib/api/nest");
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await nestFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        skipAuth: true,
      });
    }
  } catch {
    // Clear cookies regardless
  }
  await clearAuthCookies();
  redirect("/sign-in");
}

export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { success: false, errors: fieldErrors(parsed.error) };
  }

  try {
    await nestFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(parsed.data),
      skipAuth: true,
    });
  } catch (error) {
    if (error instanceof NestRequestError) {
      return { success: false, message: error.message };
    }
  }

  return {
    success: true,
    message:
      "If an account exists for that email, a password reset link has been created.",
  };
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { success: false, errors: fieldErrors(parsed.error) };
  }

  try {
    await nestFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: parsed.data.token,
        password: parsed.data.password,
      }),
      skipAuth: true,
    });
  } catch (error) {
    if (error instanceof NestRequestError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Password reset failed" };
  }

  redirect("/sign-in?reset=true");
}

export async function updateProfileAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updateProfileSchema.safeParse({
    displayName: formData.get("displayName") ?? formData.get("name"),
    bio: formData.get("bio") || undefined,
    businessName: formData.get("businessName") || undefined,
  });
  if (!parsed.success) {
    return { success: false, errors: fieldErrors(parsed.error) };
  }

  try {
    await nestFetch("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    return { success: true, message: "Profile updated" };
  } catch (error) {
    if (error instanceof NestRequestError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Update failed" };
  }
}

export async function changePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password") ?? formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { success: false, errors: fieldErrors(parsed.error) };
  }

  // Nest has no dedicated change-password endpoint yet — use reset flow is wrong.
  // Documented as missing; surface clear error instead of fake success.
  return {
    success: false,
    message:
      "Change password is not available yet. Use forgot-password, or ask for PATCH /auth/me/password on the API.",
  };
}
