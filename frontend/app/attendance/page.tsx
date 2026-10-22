"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, ShieldAlert, UserCheck } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { getMyAttendance } from "@/lib/api-service";
import { AttendanceCheckIn } from "@/components/attendance-check-in";
import { Empty, ErrorNote, Page, PageHeader, PageSkeleton, Panel, Pill, Progress, Segmented, Stat, useLoad, type Tone } from "@/components/mu/kit";
import { courseColor, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Universitet qoidasi (namuna): har bir para = 2 akademik soat. */
const HOURS_PER_LESSON = 2;
const LIMIT_HOURS = 74; // semestr bo‘yicha qoldirish chegarasi
const WARN_HOURS = 60; // ogohlantirish
const COURSE_LIMIT_HOURS = 8; // har bir fan bo‘yicha

const labels: Record<string, [string, Tone]> = {
  present: ["Qatnashdi", "green"],
  late: ["Kechikdi", "amber"],
  absent: ["Qatnashmadi", "red"],
  excused: ["Sababli", "blue"],
};

export default function Attendance() {
  const { data, loading, error, reload } = useLoad(() => getMyAttendance());
  const [filter, setFilter] = useState<"all" | "absent">("all");
  const [course, setCourse] = useState<string | null>(null);
  const rows = useMemo(() => (data ?? []) as any[], [data]);

  const v = useMemo(() => {
    const attended = rows.filter((r) => r.status === "present" || r.status === "late").length;
    const absent = rows.filter((r) => r.status === "absent").length;
    const missedHours = absent * HOURS_PER_LESSON;
    const byCourse = new Map<string, { title: string; total: number; absent: number; late: number }>();
    rows.forEach((r) => {
      const e = byCourse.get(r.course_title) ?? { title: r.course_title, total: 0, absent: 0, late: 0 };
      e.total++;
      if (r.status === "absent") e.absent++;
      if (r.status === "late") e.late++;
      byCourse.set(r.course_title, e);
    });
    return {
      attended,
      absent,
      missedHours,
      left: Math.max(0, LIMIT_HOURS - missedHours),
      rate: rows.length ? Math.round((attended / rows.length) * 100) : null,
      courses: [...byCourse.values()].sort((a, b) => b.absent - a.absent),
    };
  }, [rows]);

  const state = v.missedHours >= LIMIT_HOURS ? "red" : v.missedHours >= WARN_HOURS ? "amber" : "green";
  const stateText = state === "red" ? "Chegara oshib ketdi" : state === "amber" ? "Ogohlantirish" : "Yaxshi holat";
  const list = rows.filter((r) => (filter === "absent" ? r.status === "absent" : true) && (!course || r.course_title === course));

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader eyebrow="Davomat" title="Mening davomatim" description="Darsga kelganingizni skaner orqali belgilang, qoldirilgan soatlarni nazorat qiling." />
        <div className="mb-6">
          <AttendanceCheckIn onCheckedIn={async () => reload()} />
        </div>
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading ? (
          <PageSkeleton rows={2} />
        ) : !rows.length ? (
          <Empty icon={UserCheck} title="Davomat hali qayd etilmagan" />
        ) : (
          <div className="space-y-6">
            {/* Holat kartasi */}
            <section className={cn("rounded-3xl p-5 ring-1 ring-inset md:p-6", state === "green" ? "bg-emerald-50 ring-emerald-200" : state === "amber" ? "bg-amber-50 ring-amber-200" : "bg-rose-50 ring-rose-200")}>
              <p className={cn("flex items-center gap-2 text-sm font-semibold", state === "green" ? "text-emerald-700" : state === "amber" ? "text-amber-700" : "text-rose-700")}>
                {state === "green" ? <CheckCircle2 size={17} /> : state === "amber" ? <AlertTriangle size={17} /> : <ShieldAlert size={17} />} {stateText}
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-5xl font-semibold text-navy-900">{v.rate ?? "—"}%</span>
                <span className="text-sm text-slate-600">davomat ko‘rsatkichi</span>
              </p>
              <div className="relative mt-4">
                <Progress value={(v.missedHours / LIMIT_HOURS) * 100} tone={state} />
                <span className="absolute -top-1 h-4 w-0.5 rounded bg-amber-500" style={{ left: `${(WARN_HOURS / LIMIT_HOURS) * 100}%` }} title="Ogohlantirish chegarasi" />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-600">
                <span>{LIMIT_HOURS} soatdan <b>{v.missedHours}</b> soat qoldirilgan</span>
                <span>Ogohlantirish {WARN_HOURS} soatda · chegara {LIMIT_HOURS} soat</span>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Qatnashgan" value={`${v.attended}/${rows.length}`} tone="green" icon={UserCheck} />
              <Stat label="Qoldirilgan darslar" value={v.absent} tone="red" icon={AlertTriangle} />
              <Stat label="Qoldirilgan soatlar" value={v.missedHours} tone="amber" icon={AlertTriangle} />
              <Stat label="Chegaragacha qolgan" value={v.left} hint="soat" tone="navy" icon={ShieldAlert} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
              <Panel title="Fanlar bo‘yicha" description={`Har bir fan uchun chegara ${COURSE_LIMIT_HOURS} soat`}>
                <ul className="space-y-2">
                  {v.courses.map((c) => {
                    const h = c.absent * HOURS_PER_LESSON;
                    const tone: Tone = h >= COURSE_LIMIT_HOURS ? "red" : h >= COURSE_LIMIT_HOURS * 0.6 ? "amber" : "green";
                    const active = course === c.title;
                    return (
                      <li key={c.title}>
                        <button onClick={() => setCourse(active ? null : c.title)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-slate-50", active && "border-navy-700 bg-navy-50")}>
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: courseColor(c.title.length).dot }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-navy-900">{c.title}</span>
                            <span className="text-[11px] text-muted-foreground">{c.total} dars · {c.late} kechikish</span>
                          </span>
                          <Pill tone={tone}>{h}/{COURSE_LIMIT_HOURS}</Pill>
                          <ChevronRight size={15} className="text-slate-300" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground">Sababli (hujjatli) qoldirilgan darslar hisobga olinmaydi.</p>
              </Panel>

              <Panel
                title={course ? `Tarix: ${course}` : "Davomat tarixi"}
                icon={UserCheck}
                action={<Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "Hammasi" }, { value: "absent", label: "Qoldirilgan", count: v.absent }]} />}
              >
                {list.length ? (
                  <ul className="divide-y">
                    {list.map((r) => {
                      const [name, tone] = labels[r.status] ?? ["—", "neutral" as Tone];
                      return (
                        <li key={r.id} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-navy-900">{r.session_topic}</p>
                            <p className="truncate text-xs text-muted-foreground">{fmtDateTime(r.starts_at)}{r.note && ` · ${r.note}`}</p>
                          </div>
                          <Pill tone={tone} dot>{name}</Pill>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Empty title="Yozuv yo‘q" />
                )}
              </Panel>
            </div>
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
