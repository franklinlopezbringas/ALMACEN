"use client";
import { useState } from "react";
import { ShoppingBag, Plus, Minus, Trash2, UserRound } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { reception } from "@/lib/api/reception";
import { can } from "@/lib/auth/permissions";
import type { Member } from "@/lib/api/contracts";
import { money } from "@/lib/utils";
import { moneyUnits, type Payment } from "@/lib/api/reception-contracts";
import {
  ReceptionHeading,
  BranchPicker,
  MemberLookup,
  useOperation,
} from "./common";
import { TenderForm, Receipt } from "./tender";
type Product = Awaited<
  ReturnType<typeof gymflow.branchProducts>
>["items"][number];
type Line = { product: Product; quantity: number };
import { Returns } from "./returns";
export function ReceptionStore() {
  const user = useSession();
  const [branch, setBranch] = useState(0);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [locked, setLocked] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [pickMember, setPickMember] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const q = useOperation(
    ["products", branch, search, page],
    (s) => gymflow.branchProducts({ branchId: branch, search, page }, s),
    branch > 0,
  );
  const currency = cart[0]?.product.currencyCode ?? "PEN";
  const total =
    cart.reduce((sum, l) => sum + moneyUnits(l.product.price) * l.quantity, 0) /
    10000;
  const allowed = can(user, "STORE.SELL") && can(user, "PAYMENTS.CREATE");
  const add = (product: Product) => {
    setError("");
    if (cart.length && currency !== product.currencyCode) {
      setError("Cobra por separado los productos en otra moneda.");
      return;
    }
    const line = cart.find((l) => l.product.publicId === product.publicId);
    if ((line?.quantity ?? 0) >= (product.stock ?? 0)) {
      setError("No hay más unidades disponibles en esta sede.");
      return;
    }
    if (!line && cart.length >= 30) {
      setError("La venta admite hasta 30 productos distintos.");
      return;
    }
    setCart((current) =>
      line
        ? current.map((l) =>
            l.product.publicId === product.publicId
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          )
        : [...current, { product, quantity: 1 }],
    );
  };
  return (
    <div className="space-y-6">
      <ReceptionHeading
        title="Tienda"
        description="Venta de mostrador, stock por sede y cobro en un solo flujo."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <div className="panel grid gap-4 p-5 sm:grid-cols-2">
            <BranchPicker
              value={branch}
              onChange={(v) => {
                setBranch(v);
                setPage(1);
              }}
              disabled={cart.length > 0 || locked}
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(draft.trim());
                setPage(1);
              }}
            >
              <label className="label" htmlFor="pos-search">
                Buscar producto
              </label>
              <div className="flex gap-2">
                <input
                  id="pos-search"
                  className="field min-w-0"
                  placeholder="Nombre o SKU"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button variant="secondary" type="submit">
                  Buscar
                </Button>
              </div>
            </form>
          </div>
          {!branch ? (
            <div className="panel">
              <Empty
                title="Elige una sede para comenzar"
                description="Consulta existencias reales antes de agregar productos a la venta."
              />
            </div>
          ) : q.isPending ? (
            <Loading />
          ) : q.error ? (
            <ErrorState error={q.error} retry={() => q.refetch()} />
          ) : !q.data.items.length ? (
            <div className="panel">
              <Empty title="No hay productos para esta búsqueda" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {q.data.items.map((p) => (
                <article className="panel p-5" key={p.publicId}>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-canvas text-primary">
                      <ShoppingBag size={22} />
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${p.stock && p.stock > 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                    >
                      {p.stock === null
                        ? "Stock sin confirmar"
                        : p.stock > 0
                          ? `${p.stock} disponibles`
                          : "Sin stock"}
                    </span>
                  </div>
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="mt-1 text-xs text-muted">{p.sku}</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <strong>{money(p.price, p.currencyCode)}</strong>
                    {allowed && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          locked ||
                          checkout ||
                          !p.stock ||
                          p.stock <= 0 ||
                          p.price <= 0
                        }
                        onClick={() => add(p)}
                        aria-label={`Agregar ${p.name}`}
                      >
                        <Plus />
                        Agregar
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {q.data && (
            <Pagination
              page={page}
              total={q.data.total}
              totalPages={q.data.totalPages}
              onPage={setPage}
            />
          )}
        </section>
        <aside className="panel space-y-4 p-5 xl:sticky xl:top-24">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Venta actual</h2>
            <ShoppingBag size={20} className="text-muted" />
          </div>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          {cart.length ? (
            <>
              <ul className="divide-y divide-line">
                {cart.map((l) => (
                  <li key={l.product.publicId} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold">
                        {l.product.name}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={locked || checkout}
                        aria-label={`Quitar ${l.product.name}`}
                        onClick={() =>
                          setCart((c) =>
                            c.filter(
                              (row) =>
                                row.product.publicId !== l.product.publicId,
                            ),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="secondary"
                          size="icon"
                          disabled={locked || checkout || l.quantity <= 1}
                          aria-label={`Reducir ${l.product.name}`}
                          onClick={() =>
                            setCart((c) =>
                              c.map((row) =>
                                row.product.publicId === l.product.publicId
                                  ? { ...row, quantity: row.quantity - 1 }
                                  : row,
                              ),
                            )
                          }
                        >
                          <Minus size={14} />
                        </Button>
                        <span className="text-sm">{l.quantity}</span>
                        <Button
                          variant="secondary"
                          size="icon"
                          disabled={
                            locked ||
                            checkout ||
                            l.quantity >= (l.product.stock ?? 0)
                          }
                          aria-label={`Aumentar ${l.product.name}`}
                          onClick={() => add(l.product)}
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold">
                        {money(l.product.price * l.quantity, currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line pt-4">
                <p className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{money(total, currency)}</span>
                </p>
                <p className="mt-2 text-xs text-muted">
                  Sin descuentos adicionales. El stock se confirma al registrar
                  la venta.
                </p>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                disabled={locked || checkout}
                onClick={() => setPickMember(true)}
              >
                <UserRound />
                {member ? member.fullName : "Vincular socio · opcional"}
              </Button>
              {member && !checkout && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMember(null)}
                >
                  Venta sin socio
                </Button>
              )}
              <Button
                className="w-full"
                disabled={locked || !allowed}
                onClick={() => setCheckout(true)}
              >
                Cobrar {money(total, currency)}
              </Button>
            </>
          ) : (
            <Empty
              title="Lista para una nueva venta"
              description="Agrega productos del catálogo. La venta solo se registra al confirmar el pago."
            />
          )}
        </aside>
      </div>
      <Returns />
      <Dialog
        open={pickMember}
        onOpenChange={setPickMember}
        title="Vincular socio"
        description="La venta aparecerá en su historial de pagos."
      >
        <MemberLookup
          label="Seleccionar"
          onSelect={(m) => {
            setMember(m);
            setPickMember(false);
          }}
        />
      </Dialog>
      <Dialog
        open={checkout}
        onOpenChange={(v) => {
          if (!locked) setCheckout(v);
        }}
        title="Cobrar venta"
        description={`${cart.length} productos distintos · ${member?.fullName ?? "Venta de mostrador"}.`}
      >
        {checkout && (
          <TenderForm
            amount={total}
            currency={currency}
            branchId={branch}
            exact
            onLock={setLocked}
            onSuccess={(p) => {
              setCheckout(false);
              setReceipt(p);
              setCart([]);
              setMember(null);
            }}
            onSubmit={async (t) =>
              (
                await reception.sell({
                  requestId: t.requestId,
                  branchId: branch,
                  memberId: member?.memberId ?? null,
                  cashShiftId: t.cashShiftId,
                  currencyCode: currency,
                  items: cart.map((l) => ({
                    productPublicId: l.product.publicId,
                    quantity: l.quantity,
                    expectedUnitPrice: l.product.price,
                  })),
                  splits: t.splits,
                })
              ).payment
            }
          />
        )}
      </Dialog>
      <Dialog
        open={!!receipt}
        onOpenChange={(v) => {
          if (!v) setReceipt(null);
        }}
        title="Venta completada"
        description="Pago, caja e inventario confirmados conjuntamente."
      >
        {receipt && <Receipt id={receipt.publicId} />}
      </Dialog>
    </div>
  );
}
