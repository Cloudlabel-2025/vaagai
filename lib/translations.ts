import messages from "./translations.json";
export type TranslationValues = Record<string, string | number>;
export function translate(text: string, language: "en" | "ta" | "hi", values: TranslationValues = {}): string {
 const message = language === "en" ? text : text === "s" ? "" : (messages as Record<string, {ta:string;hi:string}>)[text]?.[language] ?? text;
 return message.replace(/\{(\w+)\}/g, (match, key: string) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
