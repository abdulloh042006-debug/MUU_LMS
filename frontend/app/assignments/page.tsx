"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarPlus, CheckCircle2, ClipboardList, Search } from "lucide-react";
import { downloadIcs } from "@/lib/ics";
import { ProtectedRoute } from "@/components/protected-route";
import { TeacherAssignments } from "@/components/teacher-assignments";
import { useAuth } from "@/contexts/auth-context";
import { getAssignments } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Page, PageHeader, PageSkeleton, Pill, Segmented, useLoad } from "@/components/mu/kit";
import { courseColor, fmtDateTime, timeLeft } from "@/lib/format";

type Filter = "todo" | "done" | "late" | "all";

export default function AssignmentsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<Page><PageSkeleton /></Page>}>
        <RoleSwitch />
      </Suspense>
    </ProtectedRoute>
  );
}

function RoleSwitch() {
  const { user } = useAuth();
  return user?.role === "ustoz" || user?.role === "admin" ? <TeacherAssignments /> : <Inner />;
}

function Inner() {
  const params = useSearchParams();
  const course = params.get("course");
  const { data, loading, error, reload } = useLoad(() => getAssignments());
  const [filter, setFilter] = useState<Filter>("todo");
  const [q, setQ] = useState("");

  const all = useMemo(() => ((data ?? []) as any[]).filter((a) => !course || String(a.course) === course), [data, course]);
  const isTodo = (a: any) => !a.is_submitted && (!a.is_overdue || a.allow_late);
  const isLate = (a: any) => !a.is_submitted && a.is_overdue && !a.allow_late;
  const shown = useMemo(() => {
    const f = all
      .filter((a) => (filter === "todo" ? isTodo(a) : filter === "done" ? a.is_submitted : filter === "late" ? isLate(a) : true))
      .filter((a) => `${a.title} ${a.course_title}`.toLowerCase().includes(q.toLowerCase()));
    return f.sort((a, b) => (filter === "done" || filter === "late" ? +new Date(b.due_date) - +new Date(a.due_date) : +new Date(a.due_date) - +new Date(b.due_date)));
  }, [all, filter, q]);

  return (
    <Page>
      <PageHeader
        eyebrow="Topshiriqlar"
        title="Vazifalar markazi"
        description="Muddatlar bo‘yicha tartiblangan topshiriqlaringiz."
        actions={
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <button
            onClick={() => downloadIcs(all.filter(isTodo).map((a) => ({ id: a.id, title: `Dedlayn: ${a.title}`, start: a.due_date, description: a.course_title })))}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold text-navy-700 shadow-card hover:bg-navy-50"
          >
            <CalendarPlus size={16} /> Taqvimga qo‘shish
          </button>
          <label className="flex h-10 w-full items-center gap-2 rounded-xl border bg-white px-3 shadow-card md:w-64">
            <Search size={16} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish…" className="w-full bg-transparent text-sm outline-none" />
          </label>
          </div>
        }
      />
      <Segmented
        className="mb-5"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "todo", label: "Bajarilishi kerak", count: all.filter(isTodo).length },
          { value: "done", label: "Topshirilgan", count: all.filter((a) => a.is_submitted).length },
          { value: "late", label: "Muddati o‘tgan", count: all.filter(isLate).length },
          { value: "all", label: "Hammasi" },
        ]}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading ? (
        <PageSkeleton rows={3} />
      ) : shown.length ? (
        <ul className="space-y-3">
          {shown.map((a) => {
            const left = timeLeft(a.due_date);
            const col = courseColor(a.course);
            return (
              <li key={a.id}>
                <Link href={`/assignments/${a.id}`} className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift" style={{ borderLeft: `4px solid ${col.dot}` }}>
                  <IconChip icon={a.is_submitted ? CheckCircle2 : ClipboardList} tone={a.is_submitted ? "green" : left.urgent ? "red" : "amber"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-900 md:text-[15px]">{a.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      <span style={{ color: col.text }} className="font-semibold">{a.course_title}</span> · {fmtDateTime(a.due_date)}
                    </p>
                  </div>
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    {a.attempts_used}/{a.max_attempts} urinish
                  </div>
                  <Pill tone={a.is_submitted ? "green" : isLate(a) ? "red" : left.urgent ? "red" : left.soon ? "amber" : "neutral"}>
                    {a.is_submitted ? "Topshirilgan" : isLate(a) ? "Muddati o‘tgan" : left.text}
                  </Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty icon={ClipboardList} title={filter === "todo" ? "Hamma topshiriq bajarilgan 🎉" : "Hech narsa topilmadi"} text="Filtrni o‘zgartirib ko‘ring." />
      )}
    </Page>
  );
}
