"use server";

import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import {
  customizerPreferencesSchema,
  parseCustomizerPreferences,
} from "@/lib/customizer-preferences";
import { DEFAULT_CUSTOMIZER_PREFERENCES } from "@/types/customizer-preferences";
import type { CustomizerPreferences } from "@/types/customizer-preferences";

const PREFS_COOKIE = "admin_customizer_prefs";

export async function getCustomizerPreferencesAction(): Promise<CustomizerPreferences> {
  const user = await getSessionUser();
  if (!user) {
    return { ...DEFAULT_CUSTOMIZER_PREFERENCES };
  }

  const jar = await cookies();
  const raw = jar.get(PREFS_COOKIE)?.value;
  if (!raw) return { ...DEFAULT_CUSTOMIZER_PREFERENCES };

  try {
    return parseCustomizerPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CUSTOMIZER_PREFERENCES };
  }
}

export async function updateCustomizerPreferencesAction(
  preferences: CustomizerPreferences,
): Promise<{
  success: boolean;
  preferences?: CustomizerPreferences;
  message?: string;
}> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, message: "Unauthorized" };
  }

  const parsed = customizerPreferencesSchema.safeParse(preferences);
  if (!parsed.success) {
    return { success: false, message: "Invalid preferences" };
  }

  const next = parseCustomizerPreferences(parsed.data);
  const jar = await cookies();
  jar.set(PREFS_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { success: true, preferences: next };
}
