import { redirect } from "next/navigation";
import { getWorkspaceUser } from "../auth";
export default async function OverviewPage() {
  if (!await getWorkspaceUser()) redirect("/signin");
  return null;
}
