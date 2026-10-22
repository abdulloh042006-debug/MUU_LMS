"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock,
  GraduationCap,
  MapPin,
  ScanLine,
  Sparkles,
  UserCheck,
  Wallet,
} from "lucide-react";
import {
  getAssignments,
  getBooks,
  getCalendar,
  getCourses,
  getFinance,
  getMyAttendance,
  getMyGrades,
} from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { Empty, Page, PageSkeleton, Panel, Pill, Progress, Ring, SeeAll, Stat, settle, useLoad, IconChip } from "@/components/mu/kit";
import { courseColor, dayKey, fmtDay, fmtFull, fmtTime, greeting, money, timeLeft } from "@/lib/format";

export function LMSDashboard() {
  const { user } = useAuth();
  const { data, loading } = useLoad(() =>
    settle({
      assignments: getAssignments,
      calendar: getCalendar,
      grades: getMyGrades,
      attendance: getMyAttendance,
      courses: getCourses,
      books: getBooks,
      finance: getFinance,
    }),
  );

  const view = useMemo(() => {
    if (!data) return null;
    const assignments: any[] = data.assignments ?? [];
    const calendar: any[] = data.calendar ?? [];
    const grades: any[] = data.grades ?? [];
    const attendance: any[] = data.attendance ?? [];
    const courses: any[] = data.courses ?? [];
    const today = dayKey(Date.now());
    const todays = calendar
      .filter((e) => e.event_type !== "assignment_deadline" && dayKey(e.start_time) === today)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
    const upcoming = calendar
      .filter((e) => e.event_type !== "assignment_deadline" && new Date(e.end_time) > new Date() && dayKey(e.start_time) !== today)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
      .slice(0, 3);
    const todo = assignments
      .filter((a) => !a.is_submitted && (!a.is_overdue || a.allow_late))
      .sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));
    const gradeValues = grades.map((g) => g.grade).filter((g) => typeof g === "number");
    const avg = gradeValues.length ? Math.round(gradeValues.reduce((s, v) => s + v, 0) / gradeValues.length) : null;
    const attended = attendance.filter((r) => r.status === "present" || r.status === "late").length;
    const rate = attendance.length ? Math.round((attended / attendance.length) * 100) : null;
    const courseCards = courses.map((c) => {
      const list = assignments.filter((a) => a.course === c.id);
      const done = list.filter((a) => a.is_submitted).length;
      return { ...c, total: list.length, done, progress: list.length ? (done / list.length) * 100 : 0 };
    });
    return { todays, upcoming, todo, avg, rate, courseCards, grades, assignments };
  }, [data]);

  const now = new Date();
  const first = (user?.fullname || "Talaba").split(" ")[0];

  return (
    <Page>
      {loading || !view ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-700 via-navy-800 to-navy-950 p-6 text-white shadow-lift md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-gold-500/15 blur-2xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-400">{fmtFull(now)}</p>
                <h1 className="mt-2 text-3xl font-semibold md:text-4xl">
                  {greeting()}, {first}! <span className="inline-block">👋</span>
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-navy-200">
                  {view.todays.length
                    ? `Bugun ${view.todays.length} ta mashg‘ulot bor${view.todo.length ? `, ${view.todo.length} ta topshiriq kutmoqda.` : "."}`
                    : view.todo.length
                      ? `Bugun darslar yo‘q. ${view.todo.length} ta topshiriq bajarilishini kutmoqda.`
                      : "Bugun hammasi joyida — dam oling yoki yangi materiallarni ko‘rib chiqing."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link href="/attendance" className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-gold-400">
                    <ScanLine size={17} /> Davomat skaneri
                  </Link>
                  <Link href="/calendar" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-inset ring-white/20 transition hover:bg-white/15">
                    <CalendarDays size={17} /> Dars jadvali
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-6 rounded-2xl bg-white/8 p-4 ring-1 ring-inset ring-white/10 backdrop-blur md:p-5">
                <Ring value={view.rate ?? 0} size={92} stroke={9} color="#c5a55a" track="rgba(255,255,255,.15)">
                  <div>
                    <p className="font-heading text-xl font-semibold">{view.rate === null ? "—" : `${view.rate}%`}</p>
                    <p className="text-[10px] text-navy-200">davomat</p>
                  </div>
                </Ring>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-heading text-2xl font-semibold">{view.avg ?? "—"}</span>
                    <span className="ml-1.5 text-xs text-navy-200">o‘rtacha ball</span>
                  </p>
                  <p className="text-xs text-navy-200">{view.courseCards.length} ta faol kurs</p>
                </div>
              </div>
            </div>
          </section>

          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Topshiriqlar" value={view.todo.length} hint="bajarilishi kerak" icon={ClipboardList} tone="amber" href="/assignments" />
            <Stat label="O‘rtacha ball" value={view.avg ?? "—"} hint={`${view.grades.length} ta baho`} icon={Award} tone="green" href="/grades" />
            <Stat label="Davomat" value={view.rate === null ? "—" : `${view.rate}%`} hint="ishtirok ulushi" icon={UserCheck} tone="blue" href="/attendance" />
            <Stat label="Materiallar" value={(data?.books ?? []).length} hint="o‘quv resurslari" icon={BookOpen} tone="violet" href="/materials" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              <Panel title="Bugungi darslar" icon={Clock} action={<SeeAll href="/calendar">Jadval</SeeAll>}>
                {view.todays.length ? (
                  <ol className="space-y-3">
                    {view.todays.map((e) => {
                      const c = courseColor(e.course);
                      const live = new Date(e.start_time) <= now && new Date(e.end_time) >= now;
                      return (
                        <li key={e.id} className="flex gap-4 rounded-2xl border p-3.5" style={{ borderLeft: `4px solid ${c.dot}` }}>
                          <div className="w-14 shrink-0 text-center">
                            <p className="font-heading text-base font-semibold text-navy-900">{fmtTime(e.start_time)}</p>
                            <p className="text-[11px] text-muted-foreground">{fmtTime(e.end_time)}</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-navy-900">{e.title}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin size={12} /> {e.room || "Xona belgilanmagan"}
                            </p>
                          </div>
                          {live ? <Pill tone="green" dot>Hozir</Pill> : e.event_type === "exam" ? <Pill tone="red">Imtihon</Pill> : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <Empty icon={Sparkles} title="Bugun mashg‘ulot yo‘q" text="Kelgusi darslar quyida ko‘rsatiladi." />
                )}
                {view.upcoming.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keyingi darslar</p>
                    <ul className="space-y-2">
                      {view.upcoming.map((e) => (
                        <li key={e.id} className="flex items-center gap-3 text-sm">
                          <span className="size-2 rounded-full" style={{ background: courseColor(e.course).dot }} />
                          <span className="min-w-0 flex-1 truncate">{e.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {fmtDay(e.start_time)}, {fmtTime(e.start_time)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>

              <Panel title="Kurslarim" icon={GraduationCap} action={<SeeAll href="/my-courses" />}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {view.courseCards.slice(0, 6).map((c) => {
                    const col = courseColor(c.id);
                    return (
                      <Link key={c.id} href={`/my-courses/${c.id}`} className="group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold" style={{ background: col.soft, color: col.text }}>
                            {String(c.code).slice(0, 3)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-navy-900">{c.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.teacher_name}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <Progress value={c.progress} thin />
                          <span className="text-[11px] font-semibold text-muted-foreground">{c.done}/{c.total}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Panel>
            </div>

            <div className="space-y-6">
              <Panel title="Yaqin muddatlar" icon={ClipboardList} action={<SeeAll href="/assignments" />}>
                {view.todo.length ? (
                  <ul className="space-y-3">
                    {view.todo.slice(0, 4).map((a) => {
                      const left = timeLeft(a.due_date);
                      return (
                        <li key={a.id}>
                          <Link href={`/assignments/${a.id}`} className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-slate-50">
                            <IconChip icon={ClipboardList} tone={left.urgent ? "red" : left.soon ? "amber" : "navy"} size={36} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-navy-900">{a.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{a.course_title}</p>
                            </div>
                            <Pill tone={left.past ? "red" : left.urgent ? "red" : left.soon ? "amber" : "neutral"}>
                              {left.past ? "Kech" : left.text}
                            </Pill>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Empty icon={Sparkles} title="Hammasi topshirilgan" text="Yangi topshiriqlar bu yerda paydo bo‘ladi." />
                )}
              </Panel>

              <Panel title="So‘nggi baholar" icon={Award} action={<SeeAll href="/grades" />}>
                {view.grades.length ? (
                  <ul className="divide-y">
                    {view.grades.slice(0, 4).map((g) => (
                      <li key={g.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-navy-900">{g.assignment?.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{g.assignment?.course_title}</p>
                        </div>
                        <Pill tone={g.grade >= 86 ? "green" : g.grade >= 70 ? "blue" : "amber"}>{g.grade}</Pill>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="Baholar hali yo‘q" />
                )}
              </Panel>

              {data?.finance && (
                <Link href="/finance" className="block rounded-2xl bg-gradient-to-br from-gold-100 to-gold-50 p-5 ring-1 ring-inset ring-gold-200 transition hover:shadow-lift">
                  <div className="flex items-center gap-3">
                    <IconChip icon={Wallet} tone="gold" />
                    <div>
                      <p className="text-xs font-medium text-gold-800">{data.finance.grant_name}</p>
                      <p className="font-heading text-xl font-semibold text-navy-900">{data.finance.grant_percent}% grant</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gold-800">
                    Keyingi to‘lov: {money(data.finance.payments.find((p: any) => p.status === "due")?.amount ?? 0)}
                  </p>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
