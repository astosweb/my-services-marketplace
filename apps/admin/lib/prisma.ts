/**
 * Prisma is no longer used by the admin UI — all data goes through @hero/api.
 * This stub keeps accidental imports from crashing at import time.
 */
export const prisma = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "Admin must not use Prisma directly. Call @hero/api via lib/api/* instead.",
      );
    },
  },
);
