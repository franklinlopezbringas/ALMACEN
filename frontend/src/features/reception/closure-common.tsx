"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { ApiError } from "@/lib/api/client";
import { closureWrite } from "@/lib/api/closure";
export type OpField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "datetime-local" | "select";
  required?: boolean;
  maxLength?: number;
  options?: { value: string; label: string }[];
  value?: string;
  min?: number;
  max?: number;
  step?: string;
};
export function OperationForm({
  fields,
  path,
  body,
  label = "Guardar",
  onSuccess,
}: {
  fields: OpField[];
  path: string;
  body: (values: Record<string, string>, requestId: string) => unknown;
  label?: string;
  onSuccess?: () => void;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const frozen = useRef<unknown>(null);
  const [locked, setLocked] = useState(false);
  const [done, setDone] = useState(false);
  const schema = z.record(z.string(), z.string()).superRefine((v, ctx) => {
    for (const f of fields) {
      const x = v[f.name] ?? "";
      if (f.required && !x.trim())
        ctx.addIssue({
          code: "custom",
          path: [f.name],
          message: "Completa este campo",
        });
      if (f.maxLength && x.length > f.maxLength)
        ctx.addIssue({
          code: "custom",
          path: [f.name],
          message: "Texto demasiado largo",
        });
    }
  });
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, f.value ?? ""]),
    ),
  });
  const mutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      if (!frozen.current) frozen.current = body(values, crypto.randomUUID());
      setLocked(true);
      await closureWrite(path, frozen.current);
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: [user.organizationPublicId] });
      setDone(true);
      onSuccess?.();
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
    >
      <fieldset
        disabled={locked || mutation.isPending || done}
        className="space-y-4"
      >
        {fields.map((f) => (
          <label className="label block" key={f.name}>
            {f.label}
            {f.required ? " *" : ""}
            {f.type === "textarea" ? (
              <textarea
                className="field mt-1 min-h-24"
                maxLength={f.maxLength}
                {...form.register(f.name)}
              />
            ) : f.type === "select" ? (
              <select className="field mt-1" {...form.register(f.name)}>
                <option value="">Seleccionar</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="field mt-1"
                type={f.type ?? "text"}
                min={f.min}
                max={f.max}
                step={f.step}
                maxLength={f.maxLength}
                {...form.register(f.name)}
              />
            )}{" "}
            {form.formState.errors[f.name] && (
              <span className="mt-1 block text-xs text-red-700">
                {form.formState.errors[f.name]?.message}
              </span>
            )}
          </label>
        ))}
      </fieldset>
      {mutation.error && (
        <ErrorState
          error={mutation.error}
          retry={() => mutation.mutate(form.getValues())}
        />
      )}
      {done ? (
        <p role="status" className="rounded-lg bg-lime/20 p-3 text-sm">
          Operación registrada correctamente.
        </p>
      ) : (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? "Guardando…"
            : locked
              ? "Reintentar misma solicitud"
              : label}
        </Button>
      )}
      {locked &&
        mutation.error instanceof ApiError &&
        [400, 403, 404, 409].includes(mutation.error.status) && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              frozen.current = null;
              setLocked(false);
              mutation.reset();
            }}
          >
            Revisar datos
          </Button>
        )}
    </form>
  );
}
export function OperationButton({
  path,
  body,
  children,
  disabled = false,
}: {
  path: string;
  body: unknown;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const id = useRef<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      id.current ??= crypto.randomUUID();
      await closureWrite(path, {
        ...(body as Record<string, unknown>),
        requestId: id.current,
      });
    },
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: [user.organizationPublicId] }),
  });
  return (
    <div>
      <Button
        variant="secondary"
        disabled={disabled || mutation.isPending || mutation.isSuccess}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Guardando…" : children}
      </Button>
      {mutation.error && (
        <ErrorState error={mutation.error} retry={() => mutation.mutate()} />
      )}
    </div>
  );
}
