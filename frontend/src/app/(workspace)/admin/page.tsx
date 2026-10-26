import { requireRole } from "@/lib/auth/session";
import { Dashboard } from "@/features/dashboard/dashboard";
export default async function Page() {
  await requireRole("ADMIN");
  return <Dashboard />;
}
