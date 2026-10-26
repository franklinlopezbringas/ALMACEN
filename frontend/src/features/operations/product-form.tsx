"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/workspace-shell";
import { gymflow } from "@/lib/api/gymflow";
import {
  productFormSchema,
  type ProductForm,
  type AdminProduct,
} from "@/lib/api/admin-contracts";
export function ProductForm({
  product,
  onClose,
}: {
  product?: AdminProduct;
  onClose: () => void;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const form = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product ?? {
      sku: "",
      name: "",
      price: 0,
      currencyCode: "PEN",
      minimumStock: 0,
      isPublic: true,
      status: "ACTIVE",
    },
  });
  const save = useMutation({
    mutationFn: (data: ProductForm) =>
      gymflow.saveProduct(
        { ...data, rowVersion: product?.rowVersion },
        product?.publicId,
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [user.organizationPublicId] });
      onClose();
    },
  });
  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((data) => save.mutate(data))}
    >
      {save.error && (
        <p role="alert" className="text-sm text-rose-700">
          {save.error.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          SKU
          <input
            className="field mt-1"
            {...form.register("sku")}
            maxLength={80}
            required
          />
        </label>
        <label className="text-sm">
          Nombre
          <input
            className="field mt-1"
            {...form.register("name")}
            maxLength={150}
            required
          />
        </label>
        <label className="text-sm">
          Precio de venta
          <input
            className="field mt-1"
            type="number"
            min="0"
            step="0.0001"
            {...form.register("price", { valueAsNumber: true })}
            required
          />
        </label>
        <label className="text-sm">
          Moneda
          <input
            className="field mt-1"
            {...form.register("currencyCode")}
            maxLength={3}
            pattern="[A-Z]{3}"
            required
          />
        </label>
        <label className="text-sm">
          Stock mínimo
          <input
            className="field mt-1"
            type="number"
            min="0"
            step="0.001"
            {...form.register("minimumStock", { valueAsNumber: true })}
            required
          />
        </label>
        <label className="text-sm">
          Estado
          <select className="field mt-1" {...form.register("status")}>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="ARCHIVED">Archivado</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register("isPublic")} />
        Visible en catálogo público
      </label>
      <p className="text-xs text-muted">
        Guardar el producto no cambia existencias. El stock se controla mediante
        movimientos de inventario.
      </p>
      {!!Object.keys(form.formState.errors).length && (
        <p role="alert" className="text-sm text-rose-700">
          Revisa los campos del formulario.
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending}
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar producto"}
        </Button>
      </div>
    </form>
  );
}
