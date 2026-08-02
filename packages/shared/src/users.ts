import { z } from "zod";
import type { UserRole, UserStatus } from "./auth";


export type UserDto = {
  id: string;
  email: string;
  displayName: string;
  businessName: string | null;
  profileName: string;
  bio: string | null;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  requestCount?: number;
  offerCount?: number;
  reviewsReceivedCount?: number;
};

export type UsersQuery = {
  page?: number;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  role?: UserRole;
  status?: UserStatus;
};

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).optional(),
  businessName: z.string().max(120).optional().nullable(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const createUserSchema = z.object({
  email: z.email(),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const bulkUserActionSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(["delete", "activate", "deactivate", "suspend"]),
});

export type BulkUserActionInput = z.infer<typeof bulkUserActionSchema>;
