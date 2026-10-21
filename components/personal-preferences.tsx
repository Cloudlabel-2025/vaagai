"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { tabFetch } from "../lib/tab-client";
import { defaultPreferences } from "../lib/preferences.mjs";
import { translate, type TranslationValues } from "../lib/translations";

export type Preferences = { language: "en" | "ta" | "hi"; textSize: "standard" | "large"; density: "comfortable" | "compact"; contrast: "standard" | "high"; motion: "system" | "reduced" | "full"; taskFilter: "All" | "Mine" };
const defaults = defaultPreferences as Preferences;
type State = { preferences: Preferences; ready: boolean; error: string; reload: () => Promise<void>; save: (preferences: Preferences) => Promise<void> };
const Context = createContext<State>({ preferences: defaults, ready: false, error: "", reload: async () => {}, save: async () => {} });
export function PersonalPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(defaults), [revision, setRevision] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState("");
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await tabFetch("/api/preferences", { signal });
      const body = await response.json();
      if (!response.ok) throw new Error("Could not load your settings. Try again.");
      setError(""); setPreferences(body.preferences); setRevision(body.revision); setReady(true);
    } catch (error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : "Could not load your settings. Try again."); }
  }, []);
  // This effect loads an external resource; reload updates state after the API response.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const controller = new AbortController(); void reload(controller.signal); return () => controller.abort(); }, [reload]);
  useEffect(() => {
    const root = document.documentElement;
    root.lang = preferences.language;
    root.dataset.textSize = preferences.textSize; root.dataset.density = preferences.density; root.dataset.contrast = preferences.contrast;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { root.dataset.reducedMotion = String(preferences.motion === "reduced" || preferences.motion === "system" && media.matches); };
    update(); media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); root.lang = "en"; for (const key of ["textSize", "density", "contrast", "reducedMotion"]) delete root.dataset[key]; };
  }, [preferences]);
  async function save(next: Preferences) {
    const response = await tabFetch("/api/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: next, revision }) });
    const body = await response.json();
    if (!response.ok) throw new Error(response.status === 409 ? "Settings changed in another tab. Reload settings and try again." : "Could not save your settings. Try again.");
    setPreferences(body.preferences); setRevision(body.revision);
  }
  return <Context.Provider value={{ preferences, ready, error, reload, save }}>{children}</Context.Provider>;
}
export function usePreferences() { return useContext(Context); }
export function useTranslation() {
  const { preferences } = usePreferences();
  return useCallback((text: string | undefined, values?: TranslationValues) => translate(text ?? "", preferences.language, values), [preferences.language]);
}
export function useReducedMotion() {
  const { preferences } = usePreferences();
  const [system, setSystem] = useState(false);
  useEffect(() => { const media = matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setSystem(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  return preferences.motion === "reduced" || preferences.motion === "system" && system;
}
