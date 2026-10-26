import { z } from "zod";
// SQL Server NEWSEQUENTIALID is a .NET Guid; do not require RFC UUID version bits.
export const loginSchema = z.object({
  email: z.email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña.").max(256),
  organizationPublicId: z.guid("Ingresa el identificador de tu gimnasio."),
});
