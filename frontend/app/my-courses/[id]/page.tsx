"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Award, BookOpen, CalendarDays, ChevronDown, ClipboardList, Download, FileText, Layers, ListChecks, UserCheck } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { downloadFile, getAssignments, getBooks, getCalendar, getCourseModules, getCourses, getMyAttendance, getMyGrades } from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, Empty, ErrorNote, IconChip, Page, PageSkeleton, Panel, Pill, Segmented, Stat, settle, useLoad } from "@/components/mu/kit";
import { courseColor, fmtDateTime, fmtDay, fmtTime, timeLeft } from "@/lib/format";

export default function CourseDetail() {
  return (
    <ProtectedRoute>
      <Inner />
    </ProtectedRoute>
  );
}

const STATUS: Record<string, [string, "green" | "red" | "amber" | "blue"]> = {
  present: ["Qatnashdi", "green"],
  late: ["Kechikdi", "amber"],
  absent: ["Qatnashmadi", "red"],
  excused: ["Sababli", "blue"],
};

function Inner() {
  const { id } = useParams();
  const cid = Number(id);
  const { user } = useAuth();
  const student = user?.role === "student";
  const [tab, setTab] = useState<"modules" | "overview" | "materials" | "tasks" | "attendance">("modules");
  const [openMod, setOpenMod] = useState<number | null>(null);
  const [dlError, setDlError] = useState("");
  const { data, loading, error, reload } = useLoad(() =>
    settle({ modules: () => getCourseModules(cid), courses: getCourses, books: getBooks, assignments: getAssignments, calendar: getCalendar, grades: student ? getMyGrades : async () => [], attendance: student ? getMyAttendance : async () => [] }),
  );

  const v = useMemo(() => {
    if (!data) return null;
    const course = (data.courses ?? []).find((c: any) => c.id === cid);
    if (!course) return { course: null } as any;
    const books = (data.books ?? []).filter((b: any) => b.course === cid);
    const assignments = (data.assignments ?? []).filter((a: any) => a.course === cid);
    const lessons = (data.calendar ?? []).filter((e: any) => e.course === cid && e.event_type !== "assignment_deadline").sort((a: any, b: any) => +new Date(a.start_time) - +new Date(b.start_time));
    const upcoming = lessons.filter((e: any) => new Date(e.end_time) > new Date()).slice(0, 4);
    const grades = (data.grades ?? []).filter((g: any) => g.assignment?.course === cid);
    const att = (data.attendance ?? []).filter((r: any) => r.course_title === course.title);
    const ok = att.filter((r: any) => r.status === "present" || r.status === "late").length;
    const gv = grades.map((g: any) => g.grade).filter((x: any) => typeof x === "number");
    return { course, books, assignments, upcoming, grades, att, rate: att.length ? Math.round((ok / att.length) * 100) : null, avg: gv.length ? Math.round(gv.reduce((s: number, x: number) => s + x, 0) / gv.length) : null };
  }, [data, cid]);

  if (loading) return <Page><PageSkeleton /></Page>;
  if (error) return <Page><ErrorNote message={error} onRetry={reload} /></Page>;
  if (!v?.course) return <Page><Empty title="Kurs topilmadi" action={<Link href="/my-courses" className="text-sm font-semibold text-navy-700 underline">Kurslarga qaytish</Link>} /></Page>;
  const col = courseColor(cid);

  return (
    <Page>
      <Link href="/my-courses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-700">
        <ArrowLeft size={16} /> Kurslarim
      </Link>
      <section className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lift md:p-8" style={{ background: `linear-gradient(135deg, ${col.dot}, ${col.text} 85%)` }}>
        <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold tracking-wide backdrop-blur">{v.course.code}</span>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{v.course.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85">{v.course.description}</p>
        <div className="mt-5 flex items-center gap-3 text-sm">
          <Avatar name={v.course.teacher_name} size={34} className="bg-white/20 !from-white/30 !to-white/10" />
          <div>
            <p className="font-semibold">{v.course.teacher_name}</p>
            <p className="text-xs text-white/75">Kurs o‘qituvchisi · {v.course.student_count} talaba</p>
          </div>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Materiallar" value={v.books.length} icon={BookOpen} tone="violet" />
        <Stat label="Topshiriqlar" value={v.assignments.length} hint={student ? `${v.assignments.filter((a: any) => a.is_submitted).length} ta topshirilgan` : undefined} icon={ClipboardList} tone="amber" />
        {student && <Stat label="O‘rtacha ball" value={v.avg ?? "—"} icon={Award} tone="green" />}
        {student && <Stat label="Davomat" value={v.rate === null ? "—" : `${v.rate}%`} icon={UserCheck} tone="blue" />}
      </div>

      <div className="mb-5 mt-6">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "modules", label: "Modullar", count: (data?.modules ?? []).length || undefined },
            { value: "overview", label: "Umumiy" },
            { value: "materials", label: "Materiallar", count: v.books.length },
            { value: "tasks", label: "Topshiriqlar", count: v.assignments.length },
            ...(student ? [{ value: "attendance" as const, label: "Davomat" }] : []),
          ]}
        />
      </div>
      {dlError && <div className="mb-4"><ErrorNote message={dlError} /></div>}

      {tab === "modules" &&
        (data?.modules?.length ? (
          <ol className="space-y-3">
            {(data.modules as any[]).map((m, i) => {
              const open = openMod === m.id || (openMod === null && i === 0);
              const count = m.materials.length + m.assignments.length + m.quizzes.length;
              return (
                <li key={m.id} className="overflow-hidden rounded-2xl border bg-white shadow-card">
                  <button onClick={() => setOpenMod(open ? -1 : m.id)} className="flex w-full items-center gap-4 p-4 text-left" aria-expanded={open}>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy-700 font-heading text-sm font-semibold text-white">{m.week}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gold-700">{m.week}-hafta</span>
                      <span className="block truncate text-sm font-semibold text-navy-900 md:text-[15px]">{m.title}</span>
                    </span>
                    <Pill>{count} element</Pill>
                    <ChevronDown size={18} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="border-t bg-slate-50/50 p-4">
                      <p className="mb-3 text-xs text-muted-foreground">{m.summary}</p>
                      <ul className="space-y-2">
                        {m.materials.map((b: any) => (
                          <li key={`b${b.id}`}>
                            <button onClick={() => downloadFile(b.file).catch((e) => setDlError(e instanceof Error ? e.message : String(e)))} className="flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left hover:bg-slate-50">
                              <IconChip icon={FileText} tone="violet" size={32} />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.title}</span>
                              <Download size={15} className="text-slate-400" />
                            </button>
                          </li>
                        ))}
                        {m.assignments.map((a: any) => (
                          <li key={`a${a.id}`}>
                            <Link href={`/assignments/${a.id}`} className="flex items-center gap-3 rounded-xl border bg-white p-3 hover:bg-slate-50">
                              <IconChip icon={ClipboardList} tone="amber" size={32} />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                              {student && <Pill tone={a.is_submitted ? "green" : "amber"}>{a.is_submitted ? "Topshirilgan" : "Topshiriq"}</Pill>}
                            </Link>
                          </li>
                        ))}
                        {m.quizzes.map((z: any) => (
                          <li key={`q${z.id}`}>
                            <Link href={`/quizzes/${z.id}`} className="flex items-center gap-3 rounded-xl border bg-white p-3 hover:bg-slate-50">
                              <IconChip icon={ListChecks} tone="blue" size={32} />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{z.title}</span>
                              <Pill tone={z.best_score !== null ? "green" : "blue"}>{z.best_score !== null ? `${z.best_score} ball` : `Test · ${z.question_count} savol`}</Pill>
                            </Link>
                          </li>
                        ))}
                        {!count && <li className="py-3 text-center text-xs text-muted-foreground">Bu modulga hali material qo‘shilmagan.</li>}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <Empty icon={Layers} title="Modullar hozircha faqat demo rejimda" text="Materiallar, topshiriqlar va davomat yonidagi bo‘limlarda." />
        ))}

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Kelgusi darslar" icon={CalendarDays}>
            {v.upcoming.length ? (
              <ul className="space-y-3">
                {v.upcoming.map((e: any) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className="w-14 text-center">
                      <p className="text-xs text-muted-foreground">{fmtDay(e.start_time)}</p>
                      <p className="font-heading text-sm font-semibold">{fmtTime(e.start_time)}</p>
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</p>
                    <Pill>{e.room || "—"}</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Rejalashtirilgan dars yo‘q" />
            )}
          </Panel>
          <Panel title="Yaqin topshiriqlar" icon={ClipboardList}>
            {v.assignments.length ? (
              <ul className="space-y-2">
                {v.assignments.slice(0, 4).map((a: any) => <TaskRow key={a.id} a={a} student={student} />)}
              </ul>
            ) : (
              <Empty title="Topshiriq yo‘q" />
            )}
          </Panel>
        </div>
      )}

      {tab === "materials" &&
        (v.books.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {v.books.map((b: any) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-card">
                <IconChip icon={FileText} tone="violet" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.subject} · {fmtDay(b.uploaded_at)}</p>
                </div>
                <button
                  onClick={() => downloadFile(b.file).catch((e) => setDlError(e instanceof Error ? e.message : String(e)))}
                  className="grid size-10 place-items-center rounded-xl bg-navy-50 text-navy-700 hover:bg-navy-100"
                  aria-label="Yuklab olish"
                >
                  <Download size={17} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={BookOpen} title="Materiallar hali yuklanmagan" />
        ))}

      {tab === "tasks" &&
        (v.assignments.length ? (
          <ul className="space-y-2.5">{v.assignments.map((a: any) => <TaskRow key={a.id} a={a} student={student} box />)}</ul>
        ) : (
          <Empty icon={ClipboardList} title="Topshiriq yo‘q" />
        ))}

      {tab === "attendance" && (
        <Panel flush bodyClassName="px-5 pb-3">
          {v.att.length ? (
            <ul className="divide-y">
              {v.att.map((r: any) => {
                const [label, tone] = STATUS[r.status] ?? ["—", "blue"];
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.session_topic}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(r.starts_at)}</p>
                    </div>
                    <Pill tone={tone}>{label}</Pill>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty icon={UserCheck} title="Davomat yozuvlari yo‘q" />
          )}
        </Panel>
      )}
    </Page>
  );
}

function TaskRow({ a, student, box }: { a: any; student: boolean; box?: boolean }) {
  const left = timeLeft(a.due_date);
  const done = a.is_submitted;
  return (
    <li>
      <Link href={`/assignments/${a.id}`} className={`flex items-center gap-3 rounded-xl p-3 transition hover:bg-slate-50 ${box ? "border bg-white shadow-card" : "border"}`}>
        <IconChip icon={ClipboardList} tone={done ? "green" : left.urgent ? "red" : "amber"} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy-900">{a.title}</p>
          <p className="text-xs text-muted-foreground">Muddat: {fmtDateTime(a.due_date)}</p>
        </div>
        {student ? (
          <Pill tone={done ? "green" : left.past ? "red" : left.urgent ? "red" : "amber"}>{done ? "Topshirilgan" : left.past ? "Muddati o‘tgan" : left.text}</Pill>
        ) : (
          <Pill>{a.submission_count} javob</Pill>
        )}
      </Link>
    </li>
  );
}
