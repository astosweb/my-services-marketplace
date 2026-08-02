/** Base URL for the public web app (landing). */
export const webUrl =
  process.env.NEXT_PUBLIC_WEB_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

export function webPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${webUrl}${normalized}`;
}
