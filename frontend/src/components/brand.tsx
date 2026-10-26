import Link from "next/link";
import { Activity } from "lucide-react";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="GymFlow, inicio"
      className="inline-flex items-center gap-2.5 text-2xl font-bold tracking-[-1px]"
    >
      <span
        className={`grid size-9 place-items-center rounded-xl ${dark ? "bg-lime text-ink" : "bg-primary text-lime"}`}
      >
        <Activity size={24} strokeWidth={2.7} />
      </span>
      GymFlow<span className="-ml-2 text-primary">.</span>
    </Link>
  );
}
