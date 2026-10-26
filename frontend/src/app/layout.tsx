import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "@fontsource-variable/manrope";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "GymFlow · Tu gimnasio, en movimiento",
    template: "%s · GymFlow",
  },
  description:
    "Conecta tu comunidad, organiza tu operación y acompaña cada progreso con GymFlow.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-3 z-[100] rounded-lg bg-white p-3 focus:not-sr-only"
        >
          Saltar al contenido
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
