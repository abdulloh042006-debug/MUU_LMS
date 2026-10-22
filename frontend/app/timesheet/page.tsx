"use client";

import { useMemo } from "react";
import { Clock3, Hourglass, Timer } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { getCalendar } from "@/lib/api-service";
import { Empty, ErrorNote, Page, PageHeader, PageSkeleton, Panel, Pill, Progress, Stat, useLoad } from "@/components/mu/kit";
import { WEEKDAYS_LONG, dayKey, fmtTime, tz } from "@/lib/format";

export default function Timesheet() {
  const { data, loading, error, reload } = useLoad(() => getCalendar());
  const v = useMemo(() => {
    const now = Date.now();
    const lessons = ((data ?? []) as any[]).filter((e) => e.event_type === "lesson" && new Date(e.end_time).getTime() - new Date(e.start_time).getTime() < 8 * 3600_000);
    const hours = (e: any) => (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 3600_000;
    const done = lessons.filter((e) => new Date(e.end_time).getTime() <= now);
    const byDay = new Map<string, any[]>();
    lessons.forEach((e) => byDay.set(dayKey(e.start_time), [...(byDay.get(dayKey(e.start_time)) ?? []), e]));
    return {
      total: lessons.reduce((s, e) => s + hours(e), 0),
      done: done.reduce((s, e) => s + hours(e), 0),
      count: lessons.length,
      days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => ({ k, list, h: list.reduce((s, e) => s + hours(e), 0), isDone: list.every((e) => new Date(e.end_time).getTime() <= now) })),
    };
  }, [data]);

  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="Ish" title="Mening tabelim" description="Dars soatlari jadval asosida avtomatik hisoblanadi." />
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading ? <PageSkeleton rows={2} /> : v.count ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="Rejadagi soat" value={`${v.total.toFixed(1)} s`} icon={Hourglass} tone="navy" />
              <Stat label="O‘tilgan soat" value={`${v.done.toFixed(1)} s`} icon={Timer} tone="green" />
              <Stat label="Darslar soni" value={v.count} icon={Clock3} tone="violet" className="col-span-2 lg:col-span-1" />
            </div>
            <Panel title="Kunlar bo‘yicha" icon={Clock3}>
              <div className="mb-4"><Progress value={v.total ? (v.done / v.total) * 100 : 0} tone="gold" /></div>
              <ul className="divide-y">
                {v.days.map((d) => (
                  <li key={d.k} className="flex items-center gap-3 py-3">
                    <div className="w-28 text-sm font-semibold text-navy-900">{WEEKDAYS_LONG[tz(d.list[0].start_time).wd]}<span className="block text-xs font-normal text-muted-foreground">{d.k.slice(5)}</span></div>
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{d.list.map((e) => `${fmtTime(e.start_time)} ${e.title}`).join(" · ")}</p>
                    <Pill tone={d.isDone ? "green" : "blue"}>{d.h.toFixed(1)} s</Pill>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        ) : <Empty icon={Clock3} title="Dars yo‘q" />}
      </Page>
    </StaffPage>
  );
}
