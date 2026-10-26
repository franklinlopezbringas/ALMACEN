import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NoAccess() {
  return (
    <main id="main-content" className="mx-auto max-w-lg p-12">
      <h1 className="text-3xl font-semibold">Tu acceso está pendiente</h1>
      <p className="my-5 text-muted">
        Pide a la administración que revise los roles de tu cuenta.
      </p>
      <Button asChild>
        <Link href="/login">Volver al ingreso</Link>
      </Button>
    </main>
  );
}
