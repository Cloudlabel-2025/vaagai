export const SESSION_MAX_SECONDS = 8 * 60 * 60;
export const SESSION_IDLE_SECONDS = 30 * 60;
export const SETUP_MAX_SECONDS = 15 * 60;
export const TAB_HEADER = "x-workspace-tab";
export function validTabId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}
export function tabCookieName(tabId: string) {
  if (!validTabId(tabId)) throw new Error("Open the sign-in page and try again.");
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}jaguar-tab-${tabId}`;
}
