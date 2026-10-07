import "server-only";

// Next may normalize request.url to localhost even when the browser uses 127.0.0.1.
// A reverse-proxy deployment can declare its public origin explicitly.
export function requestOrigin(request: Request) {
  if (process.env.JAGUAR_APP_ORIGIN) return new URL(process.env.JAGUAR_APP_ORIGIN).origin;
  const url = new URL(request.url);
  return `${url.protocol}//${request.headers.get("host") || url.host}`;
}
