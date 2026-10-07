export const workspaceSections = [
  "overview", "onboarding", "project", "tasks", "meetings", "community",
  "evidence", "raid", "c310", "growth", "control", "guide",
] as const;
export type WorkspaceView = typeof workspaceSections[number];
export function workspacePath(view: WorkspaceView) { return `/${view}`; }
export function safeWorkspaceReturn(value: string | null) {
  return value && workspaceSections.some(section => workspacePath(section) === value) ? value : "/";
}
