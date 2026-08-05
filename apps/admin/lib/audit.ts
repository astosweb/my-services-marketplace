/** Human-readable labels for audit log actions and resources. */

const ACTION_LABELS: Record<string, string> = {
  USER_JOINED: "User joined",
  USER_UPDATED: "User updated",
  USER_DELETED: "User deleted",
  SESSION_REVOKED: "Session revoked",
  SESSIONS_REVOKED: "All sessions revoked",
  DEVICE_REVOKED: "Device revoked",
  DEVICES_REVOKED: "All devices revoked",
  REQUEST_CREATED: "Request created",
  REQUEST_EDITED: "Request edited",
  REQUEST_APPROVED: "Request approved",
  REQUEST_REJECTED: "Request rejected",
  REQUEST_DELETED: "Request deleted",
  OFFER_UPDATED: "Offer updated",
  OFFER_DELETED: "Offer deleted",
  REVIEW_DELETED: "Review deleted",
};

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase();
}

export function formatAuditTarget(resource: string, resourceId: string): string {
  return `${resource}/${resourceId}`;
}
