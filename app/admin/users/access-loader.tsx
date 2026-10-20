"use client";
import { useCallback, useEffect, useState } from "react";
import { useTabId } from "../../../components/tab-session";
import { RiverAuthLoading } from "../../../components/river-auth";
import { loadAccess, saveAccess } from "./actions";
import AccessView from "./access-view";

export default function AccessLoader() {
  const tabId = useTabId();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAccess>> | null>(null);
  const [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    try { setData(await loadAccess(tabId)); setError(""); }
    catch { setData(null); setError("Could not load access. Check your connection or sign in again."); }
  }, [tabId]);
  useEffect(() => { void load(); }, [load]);
  async function save(form: FormData) {
    form.set("tabId", tabId);
    try {
      const result = await saveAccess(form);
      if (result.error) { setSaved(false); setError(result.error); return; }
      await load(); setSaved(true);
    } catch { setSaved(false); setError("Could not save. Please try again."); }
  }
  if (!data && error) return <RiverAuthLoading error title="Could not load access" detail={error}><button onClick={load}>Try again</button></RiverAuthLoading>;
  if (!data) return <RiverAuthLoading />;
  if (!data.allowed) return <main><h1>Owner access required</h1><p>Your Project Lead manages crew access.</p><a href="/overview">Return to workspace</a></main>;
  return <AccessView actor={data.actor} users={data.users} save={save} error={!!error} saved={saved} />;
}
