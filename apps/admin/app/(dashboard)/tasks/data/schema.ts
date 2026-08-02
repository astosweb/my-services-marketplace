import { z } from "zod";

const taskUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  avatar: z.string().nullable().optional(),
});

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  label: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assigneeId: z.string().nullable().optional(),
  creatorId: z.string().nullable().optional(),
  assignee: taskUserSchema.nullable().optional(),
  creator: taskUserSchema.nullable().optional(),
});

export type Task = z.infer<typeof taskSchema>;

export type TaskFormValues = {
  title: string;
  description?: string;
  status: Task["status"];
  priority: Task["priority"];
  label?: string;
  dueDate?: string;
  assigneeId?: string;
};
