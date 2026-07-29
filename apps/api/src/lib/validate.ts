import type { z, ZodType } from "zod";
import { badRequest } from "./errors.js";

/** Flatten Zod issues into a single client-facing message (field + form errors). */
export function formatZodError(error: z.ZodError): string {
  const flat = error.flatten();
  const fieldMessages = Object.entries(flat.fieldErrors).flatMap(([field, messages]) => {
    const list = Array.isArray(messages) ? messages : [];
    return list.map((message) => `${field}: ${message}`);
  });
  const messages = [...flat.formErrors, ...fieldMessages];
  return messages.join("; ") || "Invalid input";
}

/** Parse with Zod or throw a 400 AppError with field-aware messaging. */
export function parseOrThrow<TSchema extends ZodType>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw badRequest(formatZodError(parsed.error));
  }
  return parsed.data;
}
