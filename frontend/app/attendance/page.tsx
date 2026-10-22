"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { getMyAttendance } from "@/lib/api-service";
import { AttendanceCheckIn } from "@/components/attendance-check-in";
import { Empty, ErrorNote, Page, PageHeader, PageSkeleton, Panel, Pill, Ring, Stat, useLoad } from "@/components/mu/kit";
import { fmtDateTime } from "@/lib/format";
import { UserCheck } from "lucide-react";

const labels: Record<string, [string, "green" | "red" | "amber" | "blue"]> = {
  present: ["Qatnashdi", "green"],
  late: ["Kechikdi", "amber"],
  absent: ["Qatnashmadi", "red"],
  excused: ["Sababli", "blue"],
};

export default function Attendance() {
  const { data, loading, error, reload } = useLoad(() => getMyAttendance());
  const rows = (data ?? []) as any[];
  const attended = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const rate = rows.length ? Math.round((attended / rows.length) * 100) : null;

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader eyebrow="Davomat" title="Mening davomatim" description="Darsga kelganingizni skaner orqali belgilang va tarixni kuzating." />
        <div className="mb-6">
          <AttendanceCheckIn onCheckedIn={async () => reload()} />
        </div>
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading ? (
          <PageSkeleton rows={2} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-5 rounded-2xl border bg-white p-5 shadow-card">
                <Ring value={rate ?? 0} size={104} stroke={10} color="#c5a55a">
                  <p className="font-heading text-2xl font-semibold text-navy-900">{rate === null ? "—" : `${rate}%`}</p>
                </Ring>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Umumiy davomat</p>
                  <p className="mt-1 text-sm font-semibold text-navy-900">{rows.length ? `${attended} / ${rows.length} dars` : "Ma’lumot yo‘q"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(labels).map(([k, [name, tone]]) => (
                  <Stat key={k} label={name} value={rows.filter((r) => r.status === k).length} tone={tone} />
                ))}
              </div>
            </div>
            <Panel title="Davomat tarixi" icon={UserCheck}>
              {rows.length ? (
                <ul className="divide-y">
                  {rows.map((r) => {
                    const [name, tone] = labels[r.status] ?? ["—", "blue" as const];
                    return (
                      <li key={r.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-navy-900">{r.session_topic}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.course_title} · {fmtDateTime(r.starts_at)}</p>
                          {r.note && <p className="mt-1 text-xs text-slate-500">Izoh: {r.note}</p>}
                        </div>
                        <Pill tone={tone} dot>{name}</Pill>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Empty title="Davomat hali qayd etilmagan" />
              )}
            </Panel>
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
