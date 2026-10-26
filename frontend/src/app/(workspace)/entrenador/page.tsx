import { requireRole } from "@/lib/auth/session";
import { TrainerPage } from "@/features/operations/pages";
export default async function Page() {
  await requireRole("TRAINER");
  return <TrainerPage />;
}
