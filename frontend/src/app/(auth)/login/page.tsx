import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Check, MoveUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/features/auth/login-form";
export const metadata = { title: "Iniciar sesión" };
export default function Login() {
  return (
    <main id="main-content" className="grid min-h-dvh bg-white lg:grid-cols-2">
      <section className="hero-lines relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <Brand dark />
        <div className="relative z-10 max-w-lg">
          <p className="eyebrow mb-7 text-lime">Conecta. Entrena. Crece.</p>
          <h1 className="text-[clamp(40px,4.5vw,68px)] leading-[1.06] font-semibold tracking-[-3px]">
            La energía está
            <br />
            en tu comunidad.
            <br />
            <span className="text-lime">El orden, aquí.</span>
          </h1>
          <p className="mt-7 max-w-sm text-base leading-7 text-white/55">
            Un espacio para acompañar cada entrenamiento y hacer que tu gimnasio
            siga creciendo.
          </p>
          <div className="mt-10 flex flex-wrap gap-5 text-xs text-white/75">
            {["Todo conectado", "Cada rol, su espacio"].map((t) => (
              <span className="flex items-center gap-2" key={t}>
                <Check size={15} className="text-lime" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-6 text-xs text-white/40">
          <span>GymFlow · Diseñado para moverte</span>
          <MoveUpRight size={18} />
        </div>
      </section>
      <section className="flex flex-col px-6 py-8 sm:px-12">
        <Link
          href="/"
          className="flex w-fit items-center gap-2 text-sm text-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          Volver al inicio
        </Link>
        <div className="mx-auto my-auto w-full max-w-[390px] py-16">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <span className="eyebrow text-primary">BIENVENIDO A GYMFLOW</span>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-1.5px]">
            Qué bueno verte.
          </h2>
          <p className="mb-9 mt-3 text-sm leading-6 text-muted">
            Ingresa a tu cuenta y continúa donde lo dejaste.
          </p>
          <Suspense fallback={<p>Cargando formulario…</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-center text-xs text-muted">
          Tu próximo paso empieza aquí.
        </p>
      </section>
    </main>
  );
}
