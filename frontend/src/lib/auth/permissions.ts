export type Role = "ADMIN" | "RECEPTION" | "TRAINER" | "MEMBER";
export type UserSession = {
  email: string;
  organizationPublicId: string;
  roles: string[];
  permissions: string[];
  expiresAt: number;
};
export const roleHome: Record<Role, string> = {
  ADMIN: "/admin",
  RECEPTION: "/recepcion",
  TRAINER: "/entrenador",
  MEMBER: "/socio",
};
export const roleLabel: Record<Role, string> = {
  ADMIN: "Administrador",
  RECEPTION: "Recepción",
  TRAINER: "Entrenador",
  MEMBER: "Socio",
};
export function homeFor(roles: string[]) {
  const role = (["ADMIN", "RECEPTION", "TRAINER", "MEMBER"] as Role[]).find(
    (r) => roles.includes(r),
  );
  return role ? roleHome[role] : "/sin-acceso";
}
export function can(
  user: Pick<UserSession, "permissions">,
  permission?: string,
) {
  return !permission || user.permissions.includes(permission);
}
export function allowedReturnTo(path: unknown, roles: string[]) {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  )
    return homeFor(roles);
  const allowed = roles.some(
    (r) =>
      r in roleHome &&
      (path === roleHome[r as Role] ||
        path.startsWith(roleHome[r as Role] + "/")),
  );
  return allowed ? path : homeFor(roles);
}
