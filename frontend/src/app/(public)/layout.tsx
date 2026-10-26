import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#f8faf5]">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6 md:px-10">
        <Brand />
        <nav
          aria-label="Navegación pública"
          className="flex items-center gap-4 sm:gap-8"
        >
          <Link
            href="/planes"
            className="hidden text-sm font-medium hover:text-primary sm:block"
          >
            Planes
          </Link>
          <Button asChild variant="secondary">
            <Link href="/login">
              Mi espacio
              <ArrowUpRight />
            </Link>
          </Button>
        </nav>
      </header>
      {children}
      <footer className="mx-auto mt-16 flex max-w-7xl flex-wrap items-center justify-between gap-6 border-t border-line px-6 py-8 text-xs text-muted md:px-10">
        <Brand />
        <span>GymFlow · Entrena a tu manera. Crece en comunidad.</span>
        <Link href="/login">Acceso al gimnasio</Link>
      </footer>
    </div>
  );
}
