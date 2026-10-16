"use client";
import { TAB_HEADER } from "./session-policy";
export const TAB_STORAGE = "jaguar-tab-id-v1";
export async function tabFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const tabId = sessionStorage.getItem(TAB_STORAGE);
  if (tabId) headers.set(TAB_HEADER, tabId);
  const response = await fetch(input, { ...init, headers, cache: "no-store" });
  if (response.status === 401) window.dispatchEvent(new Event("jaguar-session-ended"));
  return response;
}

