import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="eyebrow text-primary">404 · Fuera de ruta</p>
      <h1 className="my-5 text-4xl font-semibold">Esta página no está aquí.</h1>
      <p className="mb-8 text-muted">
        Vuelve al inicio para encontrar lo que necesitas.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
