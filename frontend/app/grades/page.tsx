"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Award, MessageSquareText, TrendingUp } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { getMyGrades } from "@/lib/api-service";
import { Empty, ErrorNote, Page, PageHeader, PageSkeleton, Panel, Pill, Progress, Ring, Stat, useLoad } from "@/components/mu/kit";
import { courseColor, fmtDay, gradeTone } from "@/lib/format";

const label = (v: number) => (v >= 90 ? "A’lo" : v >= 80 ? "Yaxshi" : v >= 70 ? "Qoniqarli" : "Yaxshilash kerak");
const letter = (v: number) => (v >= 90 ? "A" : v >= 80 ? "B" : v >= 70 ? "C" : v >= 60 ? "D" : "F");

export default function GradesPage() {
  const { data, loading, error, reload } = useLoad(() => getMyGrades());

  const v = useMemo(() => {
    const grades = ((data ?? []) as any[]).filter((g) => typeof g.grade === "number");
    const avg = grades.length ? grades.reduce((s, g) => s + g.grade, 0) / grades.length : null;
    const byCourse = new Map<string, { id: number; title: string; sum: number; n: number }>();
    grades.forEach((g) => {
      const key = g.assignment?.course_title ?? "Boshqa";
      const e = byCourse.get(key) ?? { id: g.assignment?.course ?? 0, title: key, sum: 0, n: 0 };
      e.sum += g.grade;
      e.n++;
      byCourse.set(key, e);
    });
    return {
      grades: grades.sort((a, b) => +new Date(b.graded_at ?? 0) - +new Date(a.graded_at ?? 0)),
      avg,
      best: grades.length ? Math.max(...grades.map((g) => g.grade)) : null,
      courses: [...byCourse.values()].map((c) => ({ ...c, avg: c.sum / c.n })).sort((a, b) => b.avg - a.avg),
    };
  }, [data]);

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader eyebrow="Natijalar" title="Baholarim" description="Topshiriqlar bo‘yicha olingan ballar va ustoz izohlari." />
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading ? (
          <PageSkeleton />
        ) : !v.grades.length ? (
          <Empty icon={Award} title="Baholar hali yo‘q" text="Ustoz topshiriqlaringizni baholagach, natijalar shu yerda ko‘rinadi." />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="flex items-center gap-5 rounded-2xl border bg-white p-5 shadow-card">
                <Ring value={v.avg ?? 0} size={110} stroke={11} color="#c5a55a">
                  <div>
                    <p className="font-heading text-2xl font-semibold text-navy-900">{Math.round(v.avg ?? 0)}</p>
                    <p className="text-[10px] text-muted-foreground">/ 100</p>
                  </div>
                </Ring>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">O‘rtacha ball</p>
                  <p className="mt-1 font-heading text-2xl font-semibold text-navy-900">{letter(v.avg ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">{label(v.avg ?? 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Baholangan ish" value={v.grades.length} icon={Award} tone="navy" />
                <Stat label="Eng yuqori" value={v.best ?? "—"} icon={TrendingUp} tone="green" />
                <Stat label="Fanlar" value={v.courses.length} icon={MessageSquareText} tone="violet" className="col-span-2 sm:col-span-1" />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
              <Panel title="Fanlar bo‘yicha o‘rtacha" icon={TrendingUp}>
                <ul className="space-y-4">
                  {v.courses.map((c) => (
                    <li key={c.title}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 truncate font-medium text-navy-900">
                          <span className="size-2 rounded-full" style={{ background: courseColor(c.id).dot }} />
                          {c.title}
                        </span>
                        <b>{Math.round(c.avg)}</b>
                      </div>
                      <Progress value={c.avg} tone={gradeTone(c.avg)} thin />
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Barcha baholar" icon={Award}>
                <ul className="divide-y">
                  {v.grades.map((g) => (
                    <li key={g.id} className="py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/assignments/${g.assignment?.id}`} className="block truncate text-sm font-semibold text-navy-900 hover:underline">
                            {g.assignment?.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {g.assignment?.course_title} {g.graded_at && `· ${fmtDay(g.graded_at)}`}
                          </p>
                        </div>
                        <Pill tone={gradeTone(g.grade)}>{g.grade} · {label(g.grade)}</Pill>
                      </div>
                      {g.feedback && (
                        <p className="mt-2 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                          <MessageSquareText size={14} className="mt-0.5 shrink-0 text-navy-400" /> {g.feedback}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
