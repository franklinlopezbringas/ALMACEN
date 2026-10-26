import { requireRole } from "@/lib/auth/session";
import { WorkspaceShell } from "@/components/workspace-shell";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("MEMBER");
  return (
    <WorkspaceShell user={user} role="MEMBER">
      {children}
    </WorkspaceShell>
  );
}
