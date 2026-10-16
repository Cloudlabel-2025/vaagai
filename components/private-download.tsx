"use client";
import { useState } from "react";
import { tabFetch } from "../lib/tab-client";

export function PrivateDownload({ id, name, children }: { id: string; name: string; children: React.ReactNode }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function download(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await tabFetch(`/api/files/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error("Could not download this file. Check your access and try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setError(error instanceof Error ? error.message : "Download failed."); }
    finally { setBusy(false); }
  }
  return <><a href={`/api/files/${encodeURIComponent(id)}`} onClick={download} aria-disabled={busy}>{busy ? "Downloading…" : children}</a>{error && <span role="alert">{error}</span>}</>;
}
