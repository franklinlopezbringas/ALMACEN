import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationForm } from "@/features/reception/closure-common";
import { permittedPath } from "@/lib/api/policy";
import { closureWrite } from "@/lib/api/closure";
vi.mock("@/components/workspace-shell", () => ({
  useSession: () => ({ organizationPublicId: "test" }),
}));
vi.mock("@/lib/api/closure", () => ({ closureWrite: vi.fn() }));
describe("closure safety", () => {
  it("permits only explicit closure routes and forbids financial deletion", () => {
    expect(permittedPath("POST", "store/returns/1/process")).toBe(true);
    expect(permittedPath("POST", "shift-handoffs/1/acknowledge")).toBe(true);
    expect(permittedPath("DELETE", "store/returns/1")).toBe(false);
    expect(permittedPath("POST", "shift-handoffs/1/overwrite")).toBe(false);
  });
  it("freezes the original request after an ambiguous failure and reuses its id", async () => {
    vi.mocked(closureWrite)
      .mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce();
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <OperationForm
          fields={[{ name: "notes", label: "Notas", required: true }]}
          path="shift-handoffs"
          body={(v, requestId) => ({ ...v, requestId })}
        />
      </QueryClientProvider>,
    );
    await userEvent.type(
      screen.getByLabelText("Notas", { exact: false }),
      "Pendiente de atención",
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Notas", { exact: false })).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar misma solicitud" }),
    );
    await screen.findByText("Operación registrada correctamente.");
    expect(vi.mocked(closureWrite).mock.calls[0][1]).toEqual(
      vi.mocked(closureWrite).mock.calls[1][1],
    );
  });
});
