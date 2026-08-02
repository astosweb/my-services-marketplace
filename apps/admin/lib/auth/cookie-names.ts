/** HttpOnly JWT cookies set by the auth BFF after Nest login. */
export const ACCESS_TOKEN_COOKIE = "admin_access_token";
export const REFRESH_TOKEN_COOKIE = "admin_refresh_token";

/** Legacy name kept for proxy route checks — presence of refresh token. */
export const SESSION_COOKIE_NAME = REFRESH_TOKEN_COOKIE;
