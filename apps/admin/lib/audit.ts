"use server";

/** Activity/audit logging requires dedicated API endpoints — not available yet. */
export async function logActivity(_input: {
  actorId?: string | null;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
}) {
  return;
}

export async function logAudit(_input: {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  return;
}
