import { SessionGate } from "../../../components/tab-session";
import AccessLoader from "./access-loader";
export default function Users() {
  return <SessionGate><AccessLoader /></SessionGate>;
}
