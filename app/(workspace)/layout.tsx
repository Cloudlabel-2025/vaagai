import Workspace from "../workspace";

// Keep the shell and unsaved workspace state mounted during section navigation.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<Workspace /></>;
}
