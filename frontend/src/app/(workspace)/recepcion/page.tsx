import { requireRole } from "@/lib/auth/session";
import { ReceptionHome } from "@/features/reception/pages";
export default async function Page() {
  await requireRole("RECEPTION");
  return <ReceptionHome />;
}
