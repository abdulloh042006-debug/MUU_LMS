"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardList, GraduationCap } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { getCalendar } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Page, PageHeader, PageSkeleton, Pill, useLoad } from "@/components/mu/kit";
import { courseColor, dayKey, fmtFull, fmtTime, timeLeft } from "@/lib/format";

export default function Deadlines() {
  const { data, loading, error, reload } = useLoad(() => getCalendar());
  const groups = useMemo(() => {
    const items = ((data ?? []) as any[])
      .filter((e) => e.event_type === "assignment_deadline" || e.event_type === "exam")
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
    const map = new Map<string, any[]>();
    items.forEach((e) => map.set(dayKey(e.start_time), [...(map.get(dayKey(e.start_time)) ?? []), e]));
    return [...map.entries()];
  }, [data]);

  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="LMS" title="Muddatlar taqvimi" description="Topshiriq dedlaynlari va nazoratlar sanalar bo‘yicha." />
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading ? <PageSkeleton rows={2} /> : groups.length ? (
          <div className="space-y-6">
            {groups.map(([key, list]) => (
              <section key={key}>
                <h2 className="mb-2.5 text-sm font-semibold text-navy-800">{fmtFull(list[0].start_time)}</h2>
                <ul className="space-y-2.5">
                  {list.map((e) => {
                    const left = timeLeft(e.start_time);
                    const exam = e.event_type === "exam";
                    return (
                      <li key={e.id} className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card" style={{ borderLeft: `4px solid ${courseColor(e.course).dot}` }}>
                        <IconChip icon={exam ? GraduationCap : ClipboardList} tone={exam ? "red" : "amber"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy-900">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{e.course_title} · {fmtTime(e.start_time)}</p>
                        </div>
                        <Pill tone={left.past ? "neutral" : left.urgent ? "red" : "blue"}>{left.past ? "O‘tgan" : left.text}</Pill>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <Link href="/manage?tab=assignments" className="inline-flex text-sm font-semibold text-navy-700 underline">Topshiriqlarni boshqarish</Link>
          </div>
        ) : <Empty icon={CalendarClock} title="Yaqin muddatlar yo‘q" />}
      </Page>
    </StaffPage>
  );
}
