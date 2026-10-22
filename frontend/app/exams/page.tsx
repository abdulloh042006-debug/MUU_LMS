"use client";

import { useMemo } from "react";
import { CalendarClock, Clock, FileCheck2, GraduationCap, MapPin, Armchair } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { getExams } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Notice, Page, PageHeader, PageSkeleton, Panel, Pill, useLoad } from "@/components/mu/kit";
import { MONTHS_SHORT, courseColor, fmtFull, fmtTime, timeLeft, tz } from "@/lib/format";
import { downloadIcs } from "@/lib/ics";

export default function ExamsPage() {
  const { data, loading, error, reload } = useLoad(() => getExams());
  const { upcoming, past } = useMemo(() => {
    const rows = ((data ?? []) as any[]).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
    return { upcoming: rows.filter((e) => new Date(e.starts_at).getTime() > Date.now()), past: rows.filter((e) => new Date(e.starts_at).getTime() <= Date.now()).reverse() };
  }, [data]);
  const next = upcoming[0];

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader
          eyebrow="O‘qish"
          title="Imtihonlar"
          description="Oraliq va yakuniy nazoratlar jadvali, xona, joy va natijalar."
          actions={upcoming.length > 0 ? (
            <button onClick={() => downloadIcs(upcoming.map((e) => ({ id: `exam-${e.id}`, title: `${e.kind}: ${e.course_title}`, start: e.starts_at, end: new Date(new Date(e.starts_at).getTime() + e.duration_min * 60_000).toISOString(), description: `${e.room} · ${e.format}` })), "muu-imtihonlar.ics")} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold text-navy-700 shadow-card hover:bg-navy-50">
              <CalendarClock size={16} /> Taqvimga qo‘shish
            </button>
          ) : undefined}
        />
        {error ? <ErrorNote message="Imtihonlar bo‘limi hozircha faqat demo rejimda mavjud." onRetry={reload} /> : loading ? <PageSkeleton rows={2} /> : !upcoming.length && !past.length ? <Empty icon={GraduationCap} title="Imtihonlar e’lon qilinmagan" /> : (
          <div className="space-y-6">
            {next && (
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-700 to-navy-950 p-6 text-white shadow-lift md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">Keyingi imtihon · {timeLeft(next.starts_at).text} qoldi</p>
                <h2 className="mt-2 text-2xl font-semibold md:text-3xl">{next.course_title}</h2>
                <p className="mt-1 text-sm text-navy-200">{next.kind} · {next.format}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {[[CalendarClock, fmtFull(next.starts_at)], [Clock, `${fmtTime(next.starts_at)} · ${next.duration_min} daq`], [MapPin, next.room], [Armchair, `Joy: ${next.seat}`]].map(([I, t], k) => {
                    const Icon = I as typeof Clock;
                    return <div key={k} className="flex items-center gap-2 rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/15"><Icon size={16} className="shrink-0 text-gold-400" /> <span className="truncate">{t as string}</span></div>;
                  })}
                </div>
              </section>
            )}
            <Notice tone="gold">Imtihonga talaba ID kartasi bilan 15 daqiqa oldin keling. Telefonlar topshiriladi.</Notice>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Panel title="Kelgusi imtihonlar" icon={CalendarClock}>
                {upcoming.length ? (
                  <ul className="space-y-2.5">
                    {upcoming.map((e) => (
                      <li key={e.id} className="flex items-center gap-4 rounded-2xl border p-3.5" style={{ borderLeft: `4px solid ${courseColor(e.course).dot}` }}>
                        <div className="w-14 shrink-0 text-center">
                          <p className="font-heading text-lg font-semibold text-navy-900">{tz(e.starts_at).d}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">{MONTHS_SHORT[tz(e.starts_at).m - 1]}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy-900">{e.course_title}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.kind} · {fmtTime(e.starts_at)} · {e.room}</p>
                        </div>
                        <Pill tone={e.kind.startsWith("Yakuniy") ? "red" : "amber"}>{e.max_score} ball</Pill>
                      </li>
                    ))}
                  </ul>
                ) : <Empty title="Kelgusi imtihon yo‘q" />}
              </Panel>
              <Panel title="Natijalar" icon={FileCheck2}>
                {past.length ? (
                  <ul className="divide-y">
                    {past.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-3">
                        <IconChip icon={FileCheck2} tone="green" size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{e.course_title}</p>
                          <p className="text-xs text-muted-foreground">{e.kind}</p>
                        </div>
                        {e.score === null ? <Pill>Tekshirilmoqda</Pill> : <Pill tone="green">{e.score}/{e.max_score}</Pill>}
                      </li>
                    ))}
                  </ul>
                ) : <Empty title="Hali natija yo‘q" />}
              </Panel>
            </div>
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
