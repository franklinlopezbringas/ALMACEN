import { requireRole } from "@/lib/auth/session";
import { MemberHome } from "@/features/operations/pages";
export default async function Page() {
  await requireRole("MEMBER");
  return <MemberHome />;
}
