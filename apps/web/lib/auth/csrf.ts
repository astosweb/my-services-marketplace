/**
 * CSRF / same-origin checks for cookie-authenticated BFF proxies.
 * Browsers send Origin on cross-site and most mutating same-site requests.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isProxyPathAllowed(path: string[], allowPrefixes: string[]): boolean {
  const root = path[0] ?? "";
  return allowPrefixes.some((prefix) => root === prefix);
}

export function assertSameOriginMutation(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null;

  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (origin && host) {
    try {
      if (new URL(origin).host === host) return null;
    } catch {
      // fall through
    }
    return Response.json(
      { error: { message: "Forbidden origin", code: "CSRF_REJECTED" } },
      { status: 403 },
    );
  }

  const referer = request.headers.get("referer");
  if (referer && host) {
    try {
      if (new URL(referer).host === host) return null;
    } catch {
      // fall through
    }
    return Response.json(
      { error: { message: "Forbidden origin", code: "CSRF_REJECTED" } },
      { status: 403 },
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (!fetchSite || fetchSite === "same-origin" || fetchSite === "none") {
    return null;
  }

  return Response.json(
    { error: { message: "Forbidden origin", code: "CSRF_REJECTED" } },
    { status: 403 },
  );
}
