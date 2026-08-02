/** Query-key factory so invalidation stays consistent across features. */
export const queryKeys = {
  session: ["session"] as const,
  dashboard: ["dashboard", "stats"] as const,
  systemStatus: ["system", "status"] as const,
  users: (params?: unknown) =>
    params === undefined ? (["users"] as const) : (["users", params] as const),
  user: (id: string) => ["users", id] as const,
  requests: (params?: unknown) =>
    params === undefined
      ? (["requests"] as const)
      : (["requests", params] as const),
  offers: (params?: unknown) =>
    params === undefined ? (["offers"] as const) : (["offers", params] as const),
  reviews: (params?: unknown) =>
    params === undefined
      ? (["reviews"] as const)
      : (["reviews", params] as const),
  categories: ["categories"] as const,
  conversations: (params?: unknown) =>
    params === undefined
      ? (["conversations"] as const)
      : (["conversations", params] as const),
  roles: ["roles"] as const,
  permissions: ["permissions"] as const,
  notifications: (params?: unknown) =>
    params === undefined
      ? (["notifications"] as const)
      : (["notifications", params] as const),
};
