import { PersonalPreferencesProvider } from "../../components/personal-preferences";
import Workspace from "../workspace";
import { SessionGate } from "../../components/tab-session";

// Keep the shell and unsaved workspace state mounted during section navigation.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate><PersonalPreferencesProvider>{children}<Workspace /></PersonalPreferencesProvider></SessionGate>;
}
