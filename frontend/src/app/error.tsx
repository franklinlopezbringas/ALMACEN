"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="mx-auto max-w-lg p-10">
      <h1 className="text-3xl font-semibold">Algo no salió como esperábamos</h1>
      <p className="my-4 text-muted">Intenta cargar la página de nuevo.</p>
      <Button onClick={reset}>Volver a intentar</Button>
    </main>
  );
}
