import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

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

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).optional(),
  businessName: z.string().max(120).optional().nullable(),
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
