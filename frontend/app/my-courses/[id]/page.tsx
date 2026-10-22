"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Award, BookOpen, CalendarDays, ClipboardList, Download, FileText, UserCheck } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { downloadFile, getAssignments, getBooks, getCalendar, getCourses, getMyAttendance, getMyGrades } from "@/lib/api-service";
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
  const [tab, setTab] = useState<"overview" | "materials" | "tasks" | "attendance">("overview");
  const [dlError, setDlError] = useState("");
  const { data, loading, error, reload } = useLoad(() =>
    settle({ courses: getCourses, books: getBooks, assignments: getAssignments, calendar: getCalendar, grades: student ? getMyGrades : async () => [], attendance: student ? getMyAttendance : async () => [] }),
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
            { value: "overview", label: "Umumiy" },
            { value: "materials", label: "Materiallar", count: v.books.length },
            { value: "tasks", label: "Topshiriqlar", count: v.assignments.length },
            ...(student ? [{ value: "attendance" as const, label: "Davomat" }] : []),
          ]}
        />
      </div>
      {dlError && <div className="mb-4"><ErrorNote message={dlError} /></div>}

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
