"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useSession } from "@/components/workspace-shell";
import { personFormSchema, type PersonForm } from "@/lib/api/contracts";
import { gymflow } from "@/lib/api/gymflow";
export function PersonFormDialog({
  open,
  onClose,
  prospect = false,
}: {
  open: boolean;
  onClose: () => void;
  prospect?: boolean;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PersonForm>({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      documentNumber: "",
      documentType: "",
      notes: "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (data: PersonForm) => {
      const common = {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        email: data.email || null,
        documentNumber: data.documentNumber || null,
        documentType: data.documentType || null,
      };
      await (prospect
        ? gymflow.createProspect({
            ...common,
            leadSourceId: null,
            interestedPlanId: null,
            notes: data.notes || null,
          })
        : gymflow.createMember({ ...common, homeBranchId: null }));
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [user.organizationPublicId] });
      reset();
      onClose();
    },
  });
  const close = () => {
    if (!mutation.isPending) {
      mutation.reset();
      reset();
      onClose();
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
      title={prospect ? "Nuevo prospecto" : "Registrar socio"}
      description={
        prospect
          ? "Registra sus datos de contacto y notas de interés."
          : "Datos personales y de contacto del nuevo socio."
      }
    >
      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        noValidate
        className="space-y-4"
      >
        {mutation.error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
          >
            {mutation.error.message}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              { name: "firstName", label: "Nombres", required: true },
              { name: "lastName", label: "Apellidos", required: true },
              { name: "phone", label: "Teléfono" },
              { name: "email", label: "Correo electrónico" },
              { name: "documentType", label: "Tipo de documento" },
              { name: "documentNumber", label: "Número de documento" },
            ] as const
          ).map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="label">
                {field.label}
                {"required" in field ? " *" : ""}
              </label>
              <input
                id={field.name}
                className="field"
                type={
                  field.name === "email"
                    ? "email"
                    : field.name === "phone"
                      ? "tel"
                      : "text"
                }
                {...register(field.name)}
                maxLength={
                  field.name === "documentType"
                    ? 20
                    : field.name === "documentNumber"
                      ? 40
                      : undefined
                }
                placeholder={
                  field.name === "documentType"
                    ? "Ej. DNI, CE o pasaporte"
                    : undefined
                }
                aria-invalid={!!errors[field.name]}
                aria-describedby={
                  errors[field.name] ? field.name + "-error" : undefined
                }
              />
              {errors[field.name] && (
                <p
                  id={field.name + "-error"}
                  className="mt-1 text-xs text-rose-700"
                >
                  {errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        {prospect && (
          <div>
            <label className="label" htmlFor="notes">
              Notas de interés
            </label>
            <textarea
              id="notes"
              className="field min-h-24"
              {...register("notes")}
              maxLength={1000}
            />
          </div>
        )}
        <p className="text-xs leading-5 text-muted">
          * Campos obligatorios.{" "}
          {prospect
            ? "La conversión a socio se realiza después de confirmar su interés."
            : "Registrar al socio no activa una membresía ni genera un cobro."}
        </p>
        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={close}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Guardando…"
              : prospect
                ? "Guardar prospecto"
                : "Registrar socio"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
