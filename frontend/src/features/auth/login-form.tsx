"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/client";
import { allowedReturnTo } from "@/lib/auth/permissions";
import { loginSchema as schema } from "@/lib/auth/validation";
type Login = z.infer<typeof schema>;
export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const client = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const org = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Login>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", organizationPublicId: org },
  });
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      const user = await authApi.login(values);
      client.clear();
      router.replace(allowedReturnTo(search.get("next"), user.roles));
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No pudimos iniciar sesión.",
      );
    }
  });
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {search.get("expired") && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Tu sesión terminó. Ingresa para continuar.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      <div>
        <label className="label" htmlFor="email">
          Correo electrónico
        </label>
        <div className="relative">
          <Mail size={18} className="absolute left-3.5 top-3.5 text-muted" />
          <input
            id="email"
            type="email"
            autoComplete="username"
            className="field pl-11"
            placeholder="nombre@tugimnasio.com"
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </div>
        {errors.email && (
          <p id="email-error" className="mt-2 text-xs text-rose-700">
            {errors.email.message}
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <div className="relative">
          <LockKeyhole
            size={18}
            className="absolute left-3.5 top-3.5 text-muted"
          />
          <input
            id="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            className="field px-11"
            placeholder="Tu contraseña"
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-1 top-1 grid size-9 place-items-center text-muted"
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="mt-2 text-xs text-rose-700">
            {errors.password.message}
          </p>
        )}
      </div>
      {org ? (
        <input type="hidden" {...register("organizationPublicId")} />
      ) : (
        <div>
          <label className="label" htmlFor="organization">
            Identificador del gimnasio
          </label>
          <input
            id="organization"
            className="field"
            {...register("organizationPublicId")}
            aria-invalid={!!errors.organizationPublicId}
          />
          {errors.organizationPublicId && (
            <p className="mt-2 text-xs text-rose-700">
              {errors.organizationPublicId.message}
            </p>
          )}
        </div>
      )}
      <Button className="w-full py-3.5" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Ingresando…" : "Entrar a mi espacio"}
        <ArrowRight />
      </Button>
      <p className="text-center text-xs leading-5 text-muted">
        ¿Necesitas acceso o recuperar tu contraseña?
        <br />
        Contacta con la administración de tu gimnasio.
      </p>
    </form>
  );
}
