/**
 * Resolve the PUBLIC origin for redirects from server route handlers.
 *
 * Behind Railway's proxy, `new URL(request.url).origin` reflects the
 * container's INTERNAL address (http://localhost:8080), not the public
 * domain — redirecting a browser there strands the user on localhost.
 * The proxy passes the real public host in `x-forwarded-host`, so prefer
 * that; fall back to the raw request origin in local dev (where it is
 * correct, e.g. http://localhost:3000).
 */
export function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin;
}
