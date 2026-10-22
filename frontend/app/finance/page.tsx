"use client";

import { Banknote, CalendarClock, CheckCircle2, GraduationCap, Wallet } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { getFinance } from "@/lib/api-service";
import { ErrorNote, IconChip, Notice, Page, PageHeader, PageSkeleton, Panel, Pill, Progress, Ring, Stat, useLoad } from "@/components/mu/kit";
import { fmtDay, money } from "@/lib/format";

export default function FinancePage() {
  const { data: f, loading, error, reload } = useLoad(() => getFinance());
  const payable = f ? Math.round((f.contract_amount * (100 - f.grant_percent)) / 100) : 0;
  const paid = f ? f.payments.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + p.amount, 0) : 0;
  const next = f?.payments.find((p: any) => p.status === "due");

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader eyebrow="Universitet" title="To‘lov va grant" description={f ? `${f.academic_year} o‘quv yili bo‘yicha moliyaviy holat.` : "Kontrakt, grant va to‘lovlar."} />
        {error ? (
          <ErrorNote message="Moliya bo‘limi hozircha faqat demo rejimda mavjud. Haqiqiy serverga ulanganda bu bo‘lim yoqiladi." onRetry={reload} />
        ) : loading || !f ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-6">
            <Notice tone="gold">Bu bo‘limdagi summalar — namunaviy (demo) ma’lumotlar.</Notice>
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-700 to-navy-950 p-6 text-white shadow-lift md:p-8">
                <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-gold-500/20 blur-2xl" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">Yillik kontrakt</p>
                <p className="mt-2 font-heading text-4xl font-semibold">{money(f.contract_amount)}</p>
                <div className="mt-5 flex flex-wrap gap-6 text-sm">
                  <div><p className="text-navy-300">Grant</p><p className="font-semibold text-gold-400">−{f.grant_percent}% · {money((f.contract_amount * f.grant_percent) / 100)}</p></div>
                  <div><p className="text-navy-300">To‘lanadigan</p><p className="font-semibold">{money(payable)}</p></div>
                  <div><p className="text-navy-300">To‘langan</p><p className="font-semibold">{money(paid)}</p></div>
                </div>
                <div className="mt-6">
                  <Progress value={(paid / payable) * 100} tone="gold" className="bg-white/15" />
                  <p className="mt-2 text-xs text-navy-300">{Math.round((paid / payable) * 100)}% to‘langan · qoldiq {money(payable - paid)}</p>
                </div>
              </section>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="flex items-center gap-4 rounded-2xl border bg-gold-50 p-5 ring-1 ring-inset ring-gold-200">
                  <Ring value={f.grant_percent} size={80} stroke={9} color="#a98a3f" track="#ebdcae">
                    <b className="text-sm text-navy-900">{f.grant_percent}%</b>
                  </Ring>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{f.grant_name}</p>
                    <p className="mt-1 text-xs text-gold-800">Yuqori o‘zlashtirish uchun</p>
                  </div>
                </div>
                <Stat label="Oylik stipendiya" value={money(f.scholarship_monthly)} icon={Banknote} tone="green" />
              </div>
            </div>

            {next && (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <IconChip icon={CalendarClock} tone="amber" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">Keyingi to‘lov: {money(next.amount)}</p>
                  <p className="text-xs text-amber-800">Muddat: {fmtDay(next.date)}</p>
                </div>
              </div>
            )}

            <Panel title="To‘lovlar jadvali" icon={Wallet}>
              <ul className="divide-y">
                {f.payments.map((p: any) => (
                  <li key={p.id} className="flex items-center gap-3 py-3.5">
                    <IconChip icon={p.status === "paid" ? CheckCircle2 : GraduationCap} tone={p.status === "paid" ? "green" : p.status === "due" ? "amber" : "neutral"} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-900">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtDay(p.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-navy-900">{money(p.amount)}</p>
                      <Pill tone={p.status === "paid" ? "green" : p.status === "due" ? "amber" : "neutral"}>{p.status === "paid" ? "To‘langan" : p.status === "due" ? "Kutilmoqda" : "Rejada"}</Pill>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
