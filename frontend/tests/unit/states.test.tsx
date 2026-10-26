import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState, Pagination, Empty } from "@/components/ui/states";
describe("accessible feedback", () => {
  it("announces an error and permits a retry", async () => {
    const retry = vi.fn();
    render(<ErrorState error={new Error("Sin conexión")} retry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("disables unavailable pages and moves forward", async () => {
    const change = vi.fn();
    render(<Pagination page={1} totalPages={3} total={25} onPage={change} />);
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Página siguiente" }),
    );
    expect(change).toHaveBeenCalledWith(2);
  });
  it("explains an empty list", () => {
    render(
      <Empty title="Sin coincidencias" description="Prueba otro nombre." />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Sin coincidencias");
  });
});
