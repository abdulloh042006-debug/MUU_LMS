"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Award, ChevronRight, MessageSquareText, TrendingUp } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { getAssignments, getCourses, getMyGrades } from "@/lib/api-service";
import { Empty, ErrorNote, Page, PageHeader, PageSkeleton, Pill, Progress, Ring, Segmented, Stat, settle, useLoad } from "@/components/mu/kit";
import { courseColor, fmtDay, gradeTone } from "@/lib/format";

const label = (v: number) => (v >= 90 ? "A’lo" : v >= 80 ? "Yaxshi" : v >= 70 ? "Qoniqarli" : "Yaxshilash kerak");
const letter = (v: number) => (v >= 90 ? "A" : v >= 80 ? "B" : v >= 70 ? "C" : v >= 60 ? "D" : "F");
/** 100 ballik o‘rtachani 5 ballik GPA ga taxminiy aylantirish. */
const gpa = (v: number) => Math.max(0, Math.min(5, (v - 50) / 10)).toFixed(1);

export default function GradesPage() {
  const { data, loading, error, reload } = useLoad(() => settle({ grades: getMyGrades, courses: getCourses, assignments: getAssignments }));
  const [view, setView] = useState<"current" | "all">("current");

  const v = useMemo(() => {
    const grades = ((data?.grades ?? []) as any[]).filter((g) => typeof g.grade === "number");
    const courses = (data?.courses ?? []) as any[];
    const assignments = (data?.assignments ?? []) as any[];
    const avg = grades.length ? grades.reduce((s, g) => s + g.grade, 0) / grades.length : null;
    const subjects = courses.map((c) => {
      const gs = grades.filter((g) => g.assignment?.course === c.id);
      const total = assignments.filter((a) => a.course === c.id).length;
      return { c, gs, total, avg: gs.length ? gs.reduce((s, g) => s + g.grade, 0) / gs.length : null };
    });
    return {
      grades: [...grades].sort((a, b) => +new Date(b.graded_at ?? 0) - +new Date(a.graded_at ?? 0)),
      avg,
      best: grades.length ? Math.max(...grades.map((g) => g.grade)) : null,
      subjects: subjects.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)),
    };
  }, [data]);

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader eyebrow="Ta’lim" title="Baholar" description="Fanlar bo‘yicha joriy natijalar va barcha baholangan ishlar." />
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              <div className="flex items-center gap-5 rounded-2xl border bg-white p-5 shadow-card">
                <Ring value={v.avg ?? 0} size={110} stroke={11} color="#c5a55a">
                  <div>
                    <p className="font-heading text-2xl font-semibold text-navy-900">{v.avg === null ? "—" : Math.round(v.avg)}</p>
                    <p className="text-[10px] text-muted-foreground">/ 100</p>
                  </div>
                </Ring>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">O‘rtacha ball</p>
                  <p className="mt-1 font-heading text-2xl font-semibold text-navy-900">{v.avg === null ? "—" : `${letter(v.avg)} · GPA ${gpa(v.avg)}`}</p>
                  <p className="text-xs text-muted-foreground">{v.avg === null ? "Hali baho yo‘q" : label(v.avg)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Baholangan ish" value={v.grades.length} icon={Award} tone="navy" />
                <Stat label="Eng yuqori" value={v.best ?? "—"} icon={TrendingUp} tone="green" />
                <Stat label="Fanlar" value={v.subjects.length} icon={MessageSquareText} tone="violet" className="col-span-2 sm:col-span-1" />
              </div>
            </div>

            <Segmented value={view} onChange={setView} options={[{ value: "current", label: "Joriy semestr" }, { value: "all", label: "Barcha baholar", count: v.grades.length }]} />

            {view === "current" ? (
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">1-kurs · 2026–2027 · 1-semestr (kuzgi)</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {v.subjects.map(({ c, gs, total, avg }) => {
                    const col = courseColor(c.id);
                    return (
                      <Link key={c.id} href={`/my-courses/${c.id}`} className="group flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl font-heading text-base font-semibold" style={{ background: col.soft, color: col.text }}>
                          {avg === null ? "—" : letter(avg)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy-900">{c.title}</p>
                          {avg === null ? (
                            <p className="mt-1 text-xs text-muted-foreground">Hali baholanmagan · {total} ta topshiriq</p>
                          ) : (
                            <>
                              <Progress value={avg} tone={gradeTone(avg)} thin className="mt-2" />
                              <p className="mt-1 text-[11px] text-muted-foreground">{gs.length}/{total} ish baholangan</p>
                            </>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-heading text-xl font-semibold text-navy-900">{avg === null ? "" : Math.round(avg)}</p>
                          <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-navy-500" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : v.grades.length ? (
              <ul className="space-y-2.5">
                {v.grades.map((g) => (
                  <li key={g.id} className="rounded-2xl border bg-white p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/assignments/${g.assignment?.id}`} className="block truncate text-sm font-semibold text-navy-900 hover:underline">{g.assignment?.title}</Link>
                        <p className="text-xs text-muted-foreground">{g.assignment?.course_title}{g.graded_at && ` · ${fmtDay(g.graded_at)}`}</p>
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
            ) : (
              <Empty icon={Award} title="Baholar hali yo‘q" text="Ustoz ishlaringizni baholagach, natijalar shu yerda ko‘rinadi." />
            )}
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
