"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, Search, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { getAssignments, getCourses, getMyAttendance } from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, Empty, ErrorNote, Page, PageHeader, PageSkeleton, Progress, settle, useLoad } from "@/components/mu/kit";
import { courseColor } from "@/lib/format";

export default function MyCourses() {
  return (
    <ProtectedRoute>
      <Inner />
    </ProtectedRoute>
  );
}

function Inner() {
  const { user } = useAuth();
  const student = user?.role === "student";
  const { data, loading, error, reload } = useLoad(() =>
    settle({ courses: getCourses, assignments: getAssignments, attendance: student ? getMyAttendance : async () => [] }),
  );
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const courses: any[] = data?.courses ?? [];
    const assignments: any[] = data?.assignments ?? [];
    const attendance: any[] = data?.attendance ?? [];
    return courses
      .filter((c) => `${c.title} ${c.code} ${c.teacher_name}`.toLowerCase().includes(q.toLowerCase()))
      .map((c) => {
        const as = assignments.filter((a) => a.course === c.id);
        const done = as.filter((a) => a.is_submitted).length;
        const att = attendance.filter((r) => r.course_title === c.title);
        const ok = att.filter((r) => r.status === "present" || r.status === "late").length;
        return { ...c, total: as.length, done, progress: as.length ? (done / as.length) * 100 : 0, rate: att.length ? Math.round((ok / att.length) * 100) : null };
      });
  }, [data, q]);

  return (
    <Page>
      <PageHeader
        eyebrow="O‘quv jarayoni"
        title="Kurslarim"
        description={student ? "Fanlar bo‘yicha materiallar, topshiriqlar va davomat." : "Siz dars beradigan kurslar."}
        actions={
          <label className="flex h-10 w-full items-center gap-2 rounded-xl border bg-white px-3 shadow-card md:w-64">
            <Search size={16} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kurs qidirish…" className="w-full bg-transparent text-sm outline-none" />
          </label>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading ? (
        <PageSkeleton rows={2} />
      ) : list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const col = courseColor(c.id);
            return (
              <Link key={c.id} href={`/my-courses/${c.id}`} className="group overflow-hidden rounded-2xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-lift">
                <div className="relative h-24 p-4" style={{ background: `linear-gradient(135deg, ${col.dot}, ${col.text})` }}>
                  <span className="rounded-lg bg-white/20 px-2 py-1 text-[11px] font-bold tracking-wide text-white backdrop-blur">{c.code}</span>
                  <GraduationCap className="absolute bottom-3 right-4 text-white/25" size={48} />
                </div>
                <div className="p-4">
                  <h3 className="truncate text-[15px] font-semibold text-navy-900">{c.title}</h3>
                  <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar name={c.teacher_name} size={22} />
                    <span className="truncate">{c.teacher_name}</span>
                    <span className="ml-auto flex items-center gap-1"><Users size={13} />{c.student_count}</span>
                  </div>
                  {student && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                        <span>Topshiriqlar</span>
                        <span>{c.done}/{c.total}</span>
                      </div>
                      <Progress value={c.progress} thin />
                      {c.rate !== null && <p className="text-[11px] text-muted-foreground">Davomat: <b className="text-navy-800">{c.rate}%</b></p>}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty icon={GraduationCap} title="Kurs topilmadi" text="Qidiruv so‘zini o‘zgartirib ko‘ring." />
      )}
    </Page>
  );
}
