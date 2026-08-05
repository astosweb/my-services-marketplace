/**
 * Rewrite API / Spaces / CDN media URLs onto the admin BFF proxy
 * (`/api/uploads/...`) so the browser can load them same-origin.
 *
 * Mirrors iOS `APIConfiguration.resolveMediaURL` — needed when:
 * - API returns `http://127.0.0.1:…/uploads/…` the browser cannot reach
 * - Spaces objects are private and CDN URLs 403
 * - Admin is on a different host than `API_PUBLIC_URL`
 */
export function resolveMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;

  if (url.startsWith("/api/uploads/")) return url;
  if (url.startsWith("/uploads/")) return `/api${url}`;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const path = parsed.pathname;
  let uploadPath: string;
  if (path.startsWith("/uploads/")) {
    uploadPath = path;
  } else if (
    path.startsWith("/requests/") ||
    path.startsWith("/avatars/") ||
    path.startsWith("/messages/") ||
    path.startsWith("/support/")
  ) {
    uploadPath = `/uploads${path}`;
  } else {
    return url;
  }

  return `/api${uploadPath}${parsed.search}`;
}
