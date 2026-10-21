"use client";
import { useState } from "react";
import { Settings2 } from "lucide-react";
import { defaultPreferences } from "../lib/preferences.mjs";
import { usePreferences, useTranslation, type Preferences } from "../components/personal-preferences";

export default function PersonalSettings() {
  const { preferences, ready, error, reload, save } = usePreferences(), t = useTranslation();
  const [draftOverride, setDraft] = useState<Preferences | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [saveError, setSaveError] = useState("");
  const draft = draftOverride ?? preferences;
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences);
  const fields: { key: keyof Preferences; title: string; hint: string; options: [string, string][] }[] = [
    { key: "language", title: "Language", hint: "Choose the language used for menus, buttons and system labels. Your written content stays as entered.", options: [["en", "English"], ["ta", "தமிழ்"], ["hi", "हिन्दी"]] },
    { key: "textSize", title: "Text size", hint: "Make workspace text easier to read.", options: [["standard", "Standard"], ["large", "Large"]] },
    { key: "density", title: "Spacing", hint: "Choose how much space appears between workspace items.", options: [["comfortable", "Comfortable"], ["compact", "Compact"]] },
    { key: "contrast", title: "Contrast", hint: "Increase the contrast of text, borders and controls.", options: [["standard", "Standard"], ["high", "High"]] },
    { key: "motion", title: "Motion", hint: "Control decorative effects and movement in your workspace.", options: [["system", "Follow device setting"], ["reduced", "Reduce motion"], ["full", "Full motion"]] },
    { key: "taskFilter", title: "Default task view", hint: "Choose the task filter applied when you open the workspace.", options: [["All", "All tasks"], ["Mine", "My tasks"]] },
  ];
  async function submit(next: Preferences) {
    setBusy(true); setMessage(""); setSaveError("");
    try { await save(next); setDraft(null); setMessage("Your settings have been saved."); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save your settings. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="personal-settings" aria-labelledby="personal-settings-title">
    <header className="personal-settings-intro"><Settings2 size={28} aria-hidden="true" /><div><span className="overline">{t("YOUR WORKSPACE, YOUR WAY")}</span><h1 id="personal-settings-title">{t("Personal settings")}</h1><p>{t("These preferences belong only to you. They stay saved when you sign out and apply again when you return.")}</p></div></header>
    {error ? <div className="error-box" role="alert">{t(error)} <button onClick={() => void reload()}>{t("Try again")}</button></div> : !ready ? <p role="status">{t("Loading your settings…")}</p> : <form onSubmit={event => { event.preventDefault(); void submit(draft); }}>
      <fieldset disabled={busy} className="personal-settings-fields"><legend>{t("Preferences")}</legend>{fields.map(field => <div className="personal-setting-row" key={field.key}><div><label htmlFor={`preference-${field.key}`}>{t(field.title)}</label><p id={`hint-${field.key}`}>{t(field.hint)}</p></div><select id={`preference-${field.key}`} aria-describedby={`hint-${field.key}`} value={draft[field.key]} onChange={event => { setDraft({ ...draft, [field.key]: event.target.value }); setMessage(""); }}>
        {field.options.map(([value, label]) => <option key={value} value={value} lang={field.key === "language" ? value : undefined}>{field.key === "language" ? label : t(label)}</option>)}
      </select></div>)}</fieldset>
      <footer className="personal-settings-actions"><button type="button" disabled={busy} onClick={() => void submit(defaultPreferences as Preferences)}>{t("Reset to defaults")}</button><button className="primary" disabled={busy || !dirty} type="submit">{t(busy ? "Saving…" : "Save preferences")}</button></footer>
      <p className="personal-settings-status" role="status" aria-live="polite">{t(message || (dirty ? "You have unsaved changes." : "Your preferences are up to date."))}</p>
      {saveError && <div className="error-box" role="alert">{t(saveError)} <button type="button" disabled={busy} onClick={() => { setSaveError(""); setDraft(null); void reload(); }}>{t("Reload settings")}</button></div>}
    </form>}
  </section>;
}
