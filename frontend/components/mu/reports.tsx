"use client";

import { useMemo } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Users } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { getAttendanceRecords, getAttendanceSessions, getCourses, getTeacherSubmissions, getCourseStudents } from "@/lib/api-service";
import { Avatar, Empty, ErrorNote, Page, PageHeader, PageSkeleton, Panel, Pill, Progress, Stat, useLoad, type Tone } from "@/components/mu/kit";
import { courseColor, gradeTone } from "@/lib/format";

async function loadAll() {
  const [courses, subs, sessions] = await Promise.all([getCourses(), getTeacherSubmissions(), getAttendanceSessions()]);
  const recs = (await Promise.all((sessions as any[]).map((s) => getAttendanceRecords(s.id).catch(() => [])))).flat() as any[];
  const rosters = await Promise.all((courses as any[]).map((c) => getCourseStudents(c.id).catch(() => [])));
  return { courses: courses as any[], subs: subs as any[], sessions: sessions as any[], recs, rosters: rosters.flat() as any[] };
}

const rate = (rows: any[]) => (rows.length ? Math.round((rows.filter((r) => r.status === "present" || r.status === "late").length / rows.length) * 100) : null);

export function Reports({ kind }: { kind: "attendance" | "grades" | "at-risk" }) {
  const { data, loading, error, reload } = useLoad(loadAll);

  const v = useMemo(() => {
    if (!data) return null;
    const graded = data.subs.filter((s) => s.grade !== null).map((s) => ({ ...s, g: Number(s.grade) }));
    const byCourse = data.courses.map((c) => {
      const gs = graded.filter((s) => s.assignment.course === c.id);
      return { c, avg: gs.length ? gs.reduce((a, s) => a + s.g, 0) / gs.length : null, n: gs.length };
    });
    // talabalar bo'yicha
    const students = new Map<number, { id: number; name: string; att: any[]; grades: number[] }>();
    data.rosters.forEach((u) => students.set(u.id, { id: u.id, name: u.fullname, att: [], grades: [] }));
    data.recs.forEach((r) => students.get(r.student)?.att.push(r));
    graded.forEach((s) => students.get(s.student)?.grades.push(s.g));
    const list = [...students.values()].map((s) => {
      const a = rate(s.att);
      const g = s.grades.length ? s.grades.reduce((x, y) => x + y, 0) / s.grades.length : null;
      const reasons: string[] = [];
      if (a !== null && a < 75) reasons.push(`Davomat ${a}%`);
      if (g !== null && g < 65) reasons.push(`O‘rtacha ball ${Math.round(g)}`);
      if (s.att.filter((x) => x.status === "absent").length >= 3) reasons.push("3+ ta qoldirilgan dars");
      return { ...s, a, g, reasons };
    });
    return { graded, byCourse, list, risk: list.filter((s) => s.reasons.length).sort((x, y) => y.reasons.length - x.reasons.length) };
  }, [data]);

  const title = kind === "attendance" ? "Davomat hisoboti" : kind === "grades" ? "Baholar hisoboti" : "Xavf ostidagi talabalar";
  const desc = kind === "attendance" ? "Kurs va talabalar bo‘yicha qatnashish ko‘rsatkichlari." : kind === "grades" ? "Ballar taqsimoti va kurslar bo‘yicha o‘rtacha." : "Davomati yoki bahosi past talabalarni erta aniqlang.";

  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="Hisobotlar" title={title} description={desc} />
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading || !v || !data ? <PageSkeleton rows={2} /> : (
          <>
            {kind === "attendance" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <Stat label="Umumiy davomat" value={`${rate(data.recs) ?? "—"}${rate(data.recs) === null ? "" : "%"}`} icon={CheckCircle2} tone="green" />
                  <Stat label="Sessiyalar" value={data.sessions.length} icon={BarChart3} tone="navy" />
                  <Stat label="Kelmaganlar" value={data.recs.filter((r) => r.status === "absent").length} icon={AlertTriangle} tone="red" className="col-span-2 lg:col-span-1" />
                </div>
                <Panel title="Talabalar bo‘yicha" icon={Users}>
                  <ul className="divide-y">
                    {[...v.list].sort((a, b) => (a.a ?? 101) - (b.a ?? 101)).map((s) => (
                      <li key={s.id} className="flex items-center gap-3 py-2.5">
                        <Avatar name={s.name} size={34} />
                        <span className="w-44 truncate text-sm font-medium text-navy-900">{s.name}</span>
                        <Progress value={s.a ?? 0} tone={s.a === null ? "neutral" : s.a >= 85 ? "green" : s.a >= 70 ? "amber" : "red"} thin className="flex-1" />
                        <span className="w-12 text-right text-sm font-semibold">{s.a === null ? "—" : `${s.a}%`}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            )}
            {kind === "grades" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[["90–100", 90, 100, "green"], ["80–89", 80, 89, "blue"], ["70–79", 70, 79, "amber"], ["< 70", 0, 69, "red"]].map(([label, lo, hi, tone]) => (
                    <Stat key={label as string} label={`${label} ball`} value={v.graded.filter((s) => s.g >= (lo as number) && s.g <= (hi as number) + 0.99).length} tone={tone as Tone} icon={BarChart3} />
                  ))}
                </div>
                <Panel title="Kurslar bo‘yicha o‘rtacha ball" icon={BarChart3}>
                  <ul className="space-y-4">
                    {v.byCourse.map(({ c, avg, n }) => (
                      <li key={c.id}>
                        <div className="mb-1.5 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium text-navy-900"><span className="size-2 rounded-full" style={{ background: courseColor(c.id).dot }} />{c.title}</span><span className="text-xs text-muted-foreground">{n} ta baho · <b className="text-sm text-navy-900">{avg === null ? "—" : Math.round(avg)}</b></span></div>
                        <Progress value={avg ?? 0} tone={gradeTone(avg)} thin />
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            )}
            {kind === "at-risk" && (
              v.risk.length ? (
                <ul className="space-y-3">
                  {v.risk.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 shadow-card">
                      <Avatar name={s.name} size={42} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy-900">{s.name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">{s.reasons.map((r) => <Pill key={r} tone="red">{r}</Pill>)}</div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">Davomat <b className="text-navy-900">{s.a ?? "—"}{s.a === null ? "" : "%"}</b><br />Ball <b className="text-navy-900">{s.g === null ? "—" : Math.round(s.g)}</b></div>
                    </li>
                  ))}
                </ul>
              ) : <Empty icon={CheckCircle2} title="Xavf ostida talaba yo‘q" text="Barcha talabalar normal ko‘rsatkichda." />
            )}
          </>
        )}
      </Page>
    </StaffPage>
  );
}
