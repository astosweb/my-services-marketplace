import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt truncates beyond 72 bytes — keep Zod aligned with Nest DTOs. */
export const PASSWORD_MAX_LENGTH = 72;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  email: z.email("Invalid email address"),
  password: passwordSchema,
  displayName: z.string().min(1, "Name is required").max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** Limits match Nest `UpdateProfileDto` / `ProfileFieldsDto`. */
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  businessName: z.string().max(100).optional().nullable(),
  preferBusinessName: z.boolean().optional(),
  avatarKey: z.string().min(1).optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "BANNED";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatar: string;
  role: string;
  roleId?: string;
  permissions?: string[];
};

export type SessionResponse = {
  user: SessionUser;
  permissions: string[];
};
