import { Settings2, Backpack, Binoculars, FlagTriangleRight, FlameKindling, Footprints, Kayak, Map, Mountain, ShipWheel, TentTree } from "lucide-react";
import type { WorkspaceView } from "../lib/workspace-navigation";
import "./expedition-icon.css";

const symbols = {
  overview: Map,
  onboarding: Backpack,
  project: FlagTriangleRight,
  tasks: Kayak,
  meetings: TentTree,
  community: FlameKindling,
  evidence: Footprints,
  raid: Mountain,
  control: ShipWheel,
  settings: Settings2,
  guide: Binoculars,
} satisfies Record<WorkspaceView, typeof Map>;

// Page identity is shared by navigation, page headings and destination links.
// Adjacent text names the destination; the symbol stays decorative.
export function ExpeditionIcon({ destination, size = 24, className = "" }: {
  destination: WorkspaceView;
  size?: number;
  className?: string;
}) {
  const Symbol = symbols[destination];
  return <span className={`expedition-symbol ${className}`} data-destination={destination} style={{ width: size, height: size }} aria-hidden="true"><Symbol size={size} strokeWidth={1.7} /></span>;
}
