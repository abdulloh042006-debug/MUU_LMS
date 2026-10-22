"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, GraduationCap, Users } from "lucide-react";
import { getCalendar, getCourses, getTeacherSubmissions } from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, Empty, Page, PageSkeleton, Panel, Pill, Stat, settle, useLoad } from "@/components/mu/kit";
import { courseColor, dayKey, fmtFull, fmtTime, greeting } from "@/lib/format";

export function TeacherHome() {
  const { user } = useAuth();
  const { data, loading } = useLoad(() => settle({ courses: getCourses, rows: getTeacherSubmissions, events: getCalendar }));

  const v = useMemo(() => {
    const courses: any[] = data?.courses ?? [];
    const rows: any[] = data?.rows ?? [];
    const events: any[] = data?.events ?? [];
    const today = dayKey(Date.now());
    return {
      courses,
      pending: rows.filter((r) => r.grade === null),
      graded: rows.filter((r) => r.grade !== null).length,
      lessons: events
        .filter((e) => e.event_type === "lesson" && dayKey(e.start_time) === today)
        .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    };
  }, [data]);

  const first = (user?.fullname || "Ustoz").split(" ").slice(-1)[0];

  return (
    <Page>
      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-700 via-navy-800 to-navy-950 p-6 text-white shadow-lift md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-gold-500/15 blur-2xl" />
            <p className="relative text-xs font-medium uppercase tracking-[0.16em] text-gold-400">{fmtFull(Date.now())}</p>
            <h1 className="relative mt-2 text-3xl font-semibold md:text-4xl">{greeting()}, {first}!</h1>
            <p className="relative mt-2 max-w-xl text-sm text-navy-200">
              Bugun {v.lessons.length} ta dars bor, {v.pending.length} ta ish tekshirishni kutmoqda.
            </p>
            <div className="relative mt-5 flex flex-wrap gap-2.5">
              <Link href="/timetable" className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-950 hover:bg-gold-400">
                <CalendarDays size={17} /> Jadval va davomat
              </Link>
              <Link href="/manage?tab=grading" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-inset ring-white/20 hover:bg-white/15">
                <ClipboardCheck size={17} /> Baholash
              </Link>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Bugungi darslar" value={v.lessons.length} icon={CalendarDays} tone="navy" href="/timetable" />
            <Stat label="Tekshirish kutmoqda" value={v.pending.length} icon={ClipboardCheck} tone="amber" href="/manage?tab=grading" />
            <Stat label="Baholangan" value={v.graded} icon={CheckCircle2} tone="green" />
            <Stat label="Faol kurslar" value={v.courses.filter((c) => !c.is_archived).length} icon={GraduationCap} tone="violet" href="/manage" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Bugungi jadval" icon={CalendarDays}>
              {v.lessons.length ? (
                <ul className="space-y-2.5">
                  {v.lessons.map((l) => (
                    <li key={l.id}>
                      <Link href="/timetable" className="flex items-center gap-4 rounded-2xl border p-3.5 transition hover:bg-slate-50" style={{ borderLeft: `4px solid ${courseColor(l.course).dot}` }}>
                        <span className="w-12 font-heading text-sm font-semibold text-navy-900">{fmtTime(l.start_time)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{l.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{l.for_group || "Guruh"} · {l.room || "Xona belgilanmagan"}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={CheckCircle2} title="Bugun dars yo‘q" />
              )}
            </Panel>

            <Panel title="Tekshirish navbati" icon={ClipboardCheck} action={<Pill tone="amber">{v.pending.length}</Pill>}>
              {v.pending.length ? (
                <ul className="divide-y">
                  {v.pending.slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <Link href={`/manage?tab=grading&course=${r.assignment.course}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                        <Avatar name={r.student_name} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{r.student_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.assignment.title} · {r.attempt}-urinish</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={CheckCircle2} title="Hammasi baholangan" />
              )}
            </Panel>
          </div>

          <Panel title="Kurslarim" icon={GraduationCap}>
            {v.courses.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {v.courses.map((c) => (
                  <Link key={c.id} href={`/my-courses/${c.id}`} className="flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                    <span className="grid size-11 place-items-center rounded-xl text-xs font-bold" style={{ background: courseColor(c.id).soft, color: courseColor(c.id).text }}>{String(c.code).slice(0, 3)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.title}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users size={12} />{c.student_count} talaba{c.is_archived ? " · Arxiv" : ""}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="Birinchi kursingizni yarating" text="Boshqaruv bo‘limida kurs qo‘shing." />
            )}
          </Panel>
        </div>
      )}
    </Page>
  );
}
