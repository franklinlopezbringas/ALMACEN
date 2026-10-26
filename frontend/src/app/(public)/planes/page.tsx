import { PlanCatalog } from "@/features/plans/plan-catalog";
export const metadata = { title: "Planes para tu próxima meta" };
export default function Plans() {
  return (
    <main id="main-content" className="mx-auto max-w-7xl px-6 py-12 md:px-10">
      <div className="mb-10 max-w-2xl">
        <p className="eyebrow mb-4 text-primary">TU SIGUIENTE META</p>
        <h1 className="text-5xl font-semibold tracking-[-2px]">
          Un plan que se mueve contigo.
        </h1>
        <p className="mt-5 text-base leading-7 text-muted">
          Conoce las opciones de tu gimnasio y encuentra tu punto de partida.
          Consulta las condiciones y activa tu plan en recepción.
        </p>
      </div>
      <PlanCatalog
        organization={process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? ""}
      />
    </main>
  );
}
