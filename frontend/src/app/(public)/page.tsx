import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  HeartPulse,
  MoveUpRight,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <main id="main-content" className="mx-auto max-w-7xl px-6 md:px-10">
      <section className="grid items-center gap-10 py-12 md:py-20 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            ENTRENA. CONECTA. EVOLUCIONA.
          </span>
          <h1 className="mb-6 mt-7 text-[clamp(46px,6vw,78px)] leading-[1.02] font-semibold tracking-[-3px]">
            Haz espacio
            <br />
            para tu
            <br />
            <span className="text-primary">mejor versión.</span>
          </h1>
          <p className="max-w-md text-base leading-7 text-muted">
            No se trata solo de entrenar. Se trata de encontrar tu ritmo,
            compartir la energía y avanzar en una comunidad que te acompaña.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="px-6">
              <Link href="/planes">
                Encuentra tu plan
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/login">
                Ya soy parte
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="mt-10 flex gap-6 text-xs text-muted">
            <span className="flex items-center gap-2">
              <Check size={15} className="text-primary" />A tu ritmo
            </span>
            <span className="flex items-center gap-2">
              <Check size={15} className="text-primary" />
              En comunidad
            </span>
          </div>
        </div>
        <div className="hero-lines relative flex min-h-[460px] flex-col justify-between overflow-hidden rounded-[32px] bg-ink p-8 text-white sm:min-h-[540px]">
          <div className="flex justify-between">
            <span className="eyebrow text-lime">ENCUENTRA TU FLOW</span>
            <MoveUpRight size={27} className="text-lime" />
          </div>
          <div
            aria-hidden="true"
            className="absolute -right-12 top-20 size-96 rounded-full border-[55px] border-lime/15"
          >
            <div className="absolute inset-10 rounded-full border-[30px] border-lime/25" />
          </div>
          <div
            aria-hidden="true"
            className="relative my-12 -rotate-6 text-[110px] leading-none font-black tracking-[-10px] text-lime sm:text-[145px]"
          >
            MOVE
            <br />
            <span className="ml-14 text-white/90">YOUR</span>
            <br />
            WAY<span className="text-white">.</span>
          </div>
          <div className="relative flex items-end justify-between gap-4 border-t border-white/20 pt-6">
            <p className="max-w-52 text-sm leading-6 text-white/70">
              Tu siguiente paso no tiene que ser perfecto. Solo tiene que
              empezar.
            </p>
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-lime text-ink">
              <ArrowDown size={20} />
            </span>
          </div>
        </div>
      </section>
      <section className="border-t border-line py-12">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3 text-primary">
              MÁS QUE UN ENTRENAMIENTO
            </p>
            <h2 className="text-3xl font-semibold tracking-[-1px]">
              Un espacio que va contigo.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-muted">
            Desde tu primera clase hasta tu siguiente meta, cada parte de tu
            experiencia está conectada.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Tu ritmo, tus clases",
              text: "Consulta la agenda y encuentra una sesión que encaje con tu día.",
              icon: CalendarDays,
            },
            {
              n: "02",
              title: "Acompañamiento real",
              text: "Entrena con el apoyo de tu equipo y una comunidad que comparte tu energía.",
              icon: Users,
            },
            {
              n: "03",
              title: "Constancia que suma",
              text: "Sigue avanzando y descubre los beneficios de ser parte de tu gimnasio.",
              icon: HeartPulse,
            },
          ].map((c) => (
            <article key={c.n} className="panel p-7">
              <div className="mb-10 flex justify-between">
                <c.icon size={26} className="text-primary" />
                <span className="text-xs text-muted">{c.n}</span>
              </div>
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{c.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-lime px-8 py-9">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Sparkles size={16} />
            EL SIGUIENTE PASO ES TUYO
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Empieza a construir tu mejor hábito.
          </h2>
        </div>
        <Button asChild>
          <Link href="/planes">
            Explorar planes
            <ArrowRight />
          </Link>
        </Button>
      </section>
    </main>
  );
}
