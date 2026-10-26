"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { money } from "@/lib/utils";
import { can } from "@/lib/auth/permissions";
import { ProductForm } from "./product-form";
import type { AdminProduct } from "@/lib/api/admin-contracts";
import { PageHeading } from "./pages";

type Product = AdminProduct;
export function AdminProductsPage() {
  const user = useSession();
  const [editor, setEditor] = useState<AdminProduct | "new" | null>(null);
  const [branch, setBranch] = useState("");
  const [branchPage, setBranchPage] = useState(1);
  const [status, setStatus] = useState("");
  const allowed = can(user, "INVENTORY.MANAGE");
  const branches = useQuery({
    queryKey: [user.organizationPublicId, "branches", branchPage],
    queryFn: ({ signal }) => gymflow.branches(branchPage, signal),
  });
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Product | null>(null);
  const q = useQuery({
    queryKey: [
      user.organizationPublicId,
      "admin-products",
      search,
      page,
      branch,
      status,
    ],
    queryFn: ({ signal }) =>
      gymflow.adminProducts(
        { search, page, branchId: branch || undefined, status },
        signal,
      ),
  });
  return (
    <>
      <PageHeading
        title="Productos e inventario"
        subtitle="Gestiona productos, precios y disponibilidad por sede. Las existencias conservan su trazabilidad."
        kicker="COMERCIO"
      />
      {allowed && (
        <Button className="mb-5" onClick={() => setEditor("new")}>
          Crear producto
        </Button>
      )}
      <form
        className="panel mb-6 flex flex-wrap items-center gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <label htmlFor="product-search" className="sr-only">
          Buscar productos
        </label>
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="absolute left-3 top-3.5 text-muted" />
          <input
            id="product-search"
            className="field pl-10"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nombre o SKU"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Sede
          <select
            className="field mt-1"
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Sin sede seleccionada</option>
            {branches.data?.items.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {branches.data && branches.data.totalPages > 1 && (
          <Pagination
            page={branchPage}
            total={branches.data.total}
            totalPages={branches.data.totalPages}
            onPage={(p) => {
              setBranchPage(p);
              setBranch("");
              setPage(1);
            }}
          />
        )}
        <label className="text-sm">
          Estado del producto
          <select
            className="field mt-1"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
            <option value="ARCHIVED">Archivados</option>
          </select>
        </label>
      </div>
      {branches.error && (
        <ErrorState error={branches.error} retry={() => branches.refetch()} />
      )}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <div className="panel">
          <Empty
            title="No hay productos para esta búsqueda"
            description="Prueba otro nombre o SKU."
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((p) => (
            <article key={p.publicId} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-xl bg-canvas p-3 text-primary">
                  <Package size={24} />
                </span>
                <Badge status={p.status} />
              </div>
              <p className="eyebrow mt-5 text-muted">{p.sku}</p>
              <h2 className="mt-2 text-lg font-semibold">{p.name}</h2>
              <dl className="my-5 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Precio de venta</dt>
                  <dd className="font-semibold">
                    {money(p.price, p.currencyCode)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Stock</dt>
                  <dd>
                    {p.stock === null
                      ? "No disponible por sede"
                      : `${p.stock} unidades`}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Stock mínimo</dt>
                  <dd>{p.minimumStock} unidades</dd>
                </div>
              </dl>
              <Button
                variant="secondary"
                className="w-full"
                aria-label={`Ver producto ${p.name}`}
                onClick={() => setSelected(p)}
              >
                Ver producto
              </Button>
              {allowed && (
                <Button
                  variant="secondary"
                  className="mt-2 w-full"
                  aria-label={`Editar producto ${p.name}`}
                  onClick={() => setEditor(p)}
                >
                  Editar producto
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {q.data && (
        <div className="mt-5">
          <Pagination
            page={page}
            totalPages={q.data.totalPages}
            total={q.data.total}
            onPage={setPage}
          />
        </div>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        title={editor === "new" ? "Crear producto" : "Editar producto"}
        description="Datos comerciales y estado del producto."
      >
        {editor && (
          <ProductForm
            product={editor === "new" ? undefined : editor}
            onClose={() => setEditor(null)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.name ?? "Producto"}
        description="Ficha de consulta comercial."
      >
        {selected && (
          <dl className="grid grid-cols-2 gap-5 text-sm">
            {[
              ["SKU", selected.sku],
              [
                "Estado",
                selected.status === "ACTIVE" ? "Activo" : selected.status,
              ],
              ["Precio de venta", money(selected.price, selected.currencyCode)],
              [
                "Stock por sede",
                selected.stock === null
                  ? "No disponible"
                  : `${selected.stock} unidades`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Dialog>
    </>
  );
}
