/**
 * Validation boundary for the admin panel. Request/response contracts live in
 * `@monorepo/shared` so the API and this client validate against one source.
 */
export {
  changePasswordSchema,
  createUserSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updateUserSchema,
  PASSWORD_MIN_LENGTH,
} from "@monorepo/shared";

export type {
  CreateUserInput,
  LoginInput,
  UpdateUserInput,
  UserRole,
} from "@monorepo/shared";

export {
  customizerPreferencesSchema,
  parseCustomizerPreferences,
  mergeCustomizerPreferences,
} from "@/lib/customizer-preferences";
