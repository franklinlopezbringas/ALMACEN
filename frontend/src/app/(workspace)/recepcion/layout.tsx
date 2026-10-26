import { requireRole } from "@/lib/auth/session";
import { WorkspaceShell } from "@/components/workspace-shell";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("RECEPTION");
  return (
    <WorkspaceShell user={user} role="RECEPTION">
      {children}
    </WorkspaceShell>
  );
}
