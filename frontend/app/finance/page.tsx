"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Award, ChevronDown, CreditCard, Info, Percent, Wallet, X } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { getFinance } from "@/lib/api-service";
import { ErrorNote, IconChip, Notice, Page, PageHeader, PageSkeleton, Panel, Pill, useLoad } from "@/components/mu/kit";
import { fmtDay, money } from "@/lib/format";
import { cn } from "@/lib/utils";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(Math.abs(n))}`;

export default function FinancePage() {
  const { data: f, loading, error, reload } = useLoad(() => getFinance());
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState(false);

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader eyebrow="Moliya" title="Moliyaviy ma’lumotlar" description={f ? `${f.academic_year} o‘quv yili: shartnoma, to‘lovlar va grantlar.` : "Shartnoma, to‘lovlar va grantlar."} />
        {error ? (
          <ErrorNote message="Moliya bo‘limi hozircha faqat demo rejimda mavjud. Haqiqiy serverga ulanganda bu bo‘lim yoqiladi." onRetry={reload} />
        ) : loading || !f ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-6">
            <Notice tone="gold">Bu bo‘limdagi summalar — namunaviy (demo) ma’lumotlar.</Notice>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              {/* To'lash kerak */}
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-700 to-navy-950 p-6 text-white shadow-lift md:p-8">
                <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-gold-500/20 blur-2xl" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">To‘lash kerak</p>
                <p className="mt-2 font-heading text-4xl font-semibold md:text-5xl">
                  {Math.round(f.due_amount).toLocaleString("ru-RU")} <span className="text-xl text-navy-200">so‘m</span>
                </p>
                <p className="mt-2 text-sm text-navy-200">Muddat: <b className="text-white">{fmtDay(f.due_date)}</b> · shu summa yetishmayapti</p>
                <button onClick={() => setPay(true)} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-500 text-sm font-semibold text-navy-950 transition hover:bg-gold-400 sm:w-auto sm:px-8">
                  <CreditCard size={18} /> To‘lash
                </button>
              </section>

              {/* Hisob-kitob */}
              <section className="rounded-3xl border bg-white shadow-card">
                <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 p-5 text-left" aria-expanded={open}>
                  <span className="flex items-center gap-3">
                    <IconChip icon={Info} tone="navy" size={36} />
                    <span className="text-sm font-semibold text-navy-900">Bu summa qanday chiqdi?</span>
                  </span>
                  <ChevronDown size={18} className={cn("text-slate-400 transition", open && "rotate-180")} />
                </button>
                <div className={cn("px-5 pb-5", !open && "hidden lg:block")}>
                  <ul className="divide-y rounded-2xl bg-slate-50 px-4">
                    {f.breakdown.map((b: any) => (
                      <li key={b.label} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <span className="text-slate-600">{b.label}</span>
                        <b className={b.amount < 0 ? "text-emerald-600" : "text-navy-900"}>{b.amount < 0 ? signed(b.amount) : money(b.amount)}</b>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="font-semibold text-navy-900">To‘lash kerak</span>
                      <b className="text-rose-600">{money(f.due_amount)}</b>
                    </li>
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">1-semestr ulushi − grant − o‘tgan davrdan qoldiq = to‘lanishi kerak bo‘lgan summa.</p>
                </div>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Panel title="Operatsiyalar tarixi" icon={Wallet}>
                <div className="space-y-5">
                  {f.operations.map((o: any) => (
                    <div key={o.year}>
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-navy-900">{o.year}</p>
                        <p className="text-[11px] text-muted-foreground">Hisoblangan {money(o.accrued)} · To‘langan {money(o.paid)}</p>
                      </div>
                      <ul className="divide-y rounded-2xl border">
                        {o.items.map((it: any) => (
                          <li key={it.id} className="flex items-center gap-3 p-3.5">
                            <IconChip icon={it.amount < 0 ? ArrowUpRight : it.title.includes("Chegirma") ? Percent : ArrowDownLeft} tone={it.amount < 0 ? "red" : "green"} size={34} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-navy-900">{it.title}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{fmtDay(it.date)} · {it.note}</p>
                            </div>
                            <b className={cn("shrink-0 text-sm", it.amount < 0 ? "text-rose-600" : "text-emerald-600")}>{signed(it.amount)}</b>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Grantlar" icon={Award}>
                <ul className="space-y-3">
                  {f.grants.map((g: any) => (
                    <li key={g.id} className={cn("rounded-2xl border p-4", g.status === "granted" ? "border-emerald-200 bg-emerald-50/60" : "bg-white")}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-navy-900">{g.title}</p>
                        <span className={cn("rounded-full px-2.5 py-1 font-heading text-sm font-semibold", g.status === "granted" ? "bg-emerald-600 text-white" : "bg-gold-100 text-gold-800")}>{g.percent}%</span>
                      </div>
                      <Pill tone={g.status === "granted" ? "green" : "gold"} className="mt-2">{g.status === "granted" ? "Berildi" : "Ariza ochiq"}</Pill>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{g.description}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        )}

        {pay && f && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="To‘lov">
            <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-navy-900">Kontrakt to‘lovi</h2>
                <button onClick={() => setPay(false)} aria-label="Yopish" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Summa: <b className="text-navy-900">{money(f.due_amount)}</b></p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {["Click", "Payme", "Uzum"].map((p) => (
                  <div key={p} className="grid h-14 place-items-center rounded-xl border text-sm font-semibold text-slate-400">{p}</div>
                ))}
              </div>
              <div className="mt-4"><Notice tone="amber">Demo rejimda onlayn to‘lov o‘chirilgan. Haqiqiy tizimda to‘lov tizimi sahifasiga yo‘naltiriladi.</Notice></div>
              <button onClick={() => setPay(false)} className="mt-5 h-11 w-full rounded-xl border text-sm font-semibold hover:bg-slate-50">Yopish</button>
            </div>
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
