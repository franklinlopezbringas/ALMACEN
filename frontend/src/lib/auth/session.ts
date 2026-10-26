import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { seal, unseal } from "./crypto";
import { homeFor, type Role, type UserSession } from "./permissions";
const accessName = "gf_access",
  refreshName = "gf_refresh";
const accessTailName = "gf_access_tail";
const claimsSchema = z.object({
  email: z.email(),
  org_public: z.guid(),
  exp: z.number(),
  perm: z.union([z.string(), z.array(z.string())]).optional(),
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": z
    .union([z.string(), z.array(z.string())])
    .optional(),
});
const array = (value: string | string[] | undefined) =>
  value ? (Array.isArray(value) ? value : [value]) : [];
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  accessTokenExpiresAtUtc: string;
};
export function sessionFromToken(token: string): UserSession | null {
  try {
    const c = claimsSchema.parse(
      JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()),
    );
    return {
      email: c.email,
      organizationPublicId: c.org_public,
      expiresAt: c.exp,
      roles: array(
        c["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
      ),
      permissions: array(c.perm),
    };
  } catch {
    return null;
  }
}
export async function tokens() {
  const jar = await cookies();
  return {
    access: unseal(
      (jar.get(accessName)?.value ?? "") +
        (jar.get(accessTailName)?.value ?? ""),
      accessName,
    ),
    refresh: unseal(jar.get(refreshName)?.value, refreshName),
  };
}
export async function session() {
  const { access } = await tokens();
  return access ? sessionFromToken(access) : null;
}
export async function requireRole(role: Role) {
  const user = await session();
  if (!user) redirect("/login");
  if (!user.roles.includes(role)) redirect(homeFor(user.roles));
  return user;
}
export async function saveSession(auth: AuthResponse) {
  if (!sessionFromToken(auth.accessToken))
    throw new Error("Invalid authentication response");
  const jar = await cookies();
  const expires = new Date(auth.refreshTokenExpiresAtUtc);
  const options = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
  const encrypted = seal(auth.accessToken, accessName);
  if (encrypted.length > 7000)
    throw new Error("Session exceeds supported cookie size");
  jar.set(accessName, encrypted.slice(0, 3500), options);
  if (encrypted.length > 3500)
    jar.set(accessTailName, encrypted.slice(3500), options);
  else jar.delete(accessTailName);
  jar.set(refreshName, seal(auth.refreshToken, refreshName), options);
}
export async function clearSession() {
  const jar = await cookies();
  jar.delete(accessName);
  jar.delete(accessTailName);
  jar.delete(refreshName);
}
