import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ClipboardList, ChartNoAxesCombined } from "lucide-react";
import { Brand } from "@/components/portal-shell";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-navy-900 lg:block">
        <img src="/brand/campus.webp" alt="Millat Umidi universiteti" className="absolute inset-0 size-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-900/70 to-navy-800/60" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/login">
            <Brand light />
          </Link>
          <div className="max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">Millat Umidi University</p>
            <h1 className="mt-4 font-heading text-5xl font-semibold leading-[1.1]">
              Bilimga yo‘l.
              <br />
              <span className="text-gold-500">Kelajakka qadam.</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-navy-200">
              Dars jadvali, topshiriqlar, baholar, davomat va universitet xizmatlari — bitta qulay platformada.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5 text-sm">
              {[
                [BookOpen, "O‘quv materiallari"],
                [ClipboardList, "Topshiriqlar"],
                [ChartNoAxesCombined, "Natijalar"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof BookOpen;
                return (
                  <span key={label as string} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 backdrop-blur">
                    <I size={15} className="text-gold-500" /> {label as string}
                  </span>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-navy-300">© Millat Umidi University</p>
        </div>
      </section>
      <section className="flex flex-col items-center justify-center bg-white px-5 py-10 sm:px-10">
        <div className="mb-8 lg:hidden">
          <Brand />
        </div>
        <div className="w-full max-w-[420px]">{children}</div>
        <p className="mt-10 text-center text-xs text-muted-foreground">Ta’limingizga diqqat qarating. Qolganini tartibga solamiz.</p>
      </section>
    </div>
  );
}
