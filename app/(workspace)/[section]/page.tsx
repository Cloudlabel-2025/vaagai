import { workspaceSections } from "../../../lib/workspace-navigation";

export const dynamicParams = false;
export function generateStaticParams() {
  return workspaceSections.map(section => ({ section }));
}
export default function WorkspaceSectionPage() { return null; }
