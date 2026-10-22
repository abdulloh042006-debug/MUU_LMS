"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardCheck, FileWarning, MapPin, Play, Sparkles } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { DEMO_MODE } from "@/lib/demo-api";
import * as api from "@/lib/api-service";
import { Empty, ErrorNote, Page, PageHeader, PageSkeleton, Pill, useLoad } from "@/components/mu/kit";
import {
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  courseColor,
  dayKey,
  dayKeyFromUtcMidnight,
  fmtDayLong,
  fmtTime,
  weekStart as weekStartMs,
} from "@/lib/format";
import { cn } from "@/lib/utils";

function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (DEMO_MODE) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Lokatsiya xizmati topilmadi."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => reject(new Error("Darsni boshlash uchun lokatsiyaga ruxsat bering va GPSni yoqing.")),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  });
}

async function unlockAudio() {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const w = window as Window & { __muuAttendanceAudioContext?: AudioContext };
  const ctx = w.__muuAttendanceAudioContext || new Ctor();
  w.__muuAttendanceAudioContext = ctx;
  await ctx.resume().catch(() => undefined);
}

const typeInfo = (t: string) =>
  t === "exam"
    ? { label: "Imtihon", tone: "red" as const }
    : t === "assignment_deadline"
      ? { label: "Dedlayn", tone: "amber" as const }
      : { label: "Dars", tone: "navy" as const };

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <Schedule />
    </ProtectedRoute>
  );
}

function Schedule() {
  const { user } = useAuth();
  const router = useRouter();
  const teacher = user?.role === "ustoz" || user?.role === "admin";
  const { data, loading, error, reload } = useLoad(() => api.getCalendar());
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(dayKey(Date.now()));
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const days = useMemo(() => {
    const start = weekStartMs(offset);
    return Array.from({ length: 7 }, (_, i) => {
      const ms = start + i * 86_400_000;
      const d = new Date(ms);
      return { key: dayKeyFromUtcMidnight(ms), wd: WEEKDAYS_SHORT[(i + 1) % 7], date: d.getUTCDate(), month: d.getUTCMonth() };
    });
  }, [offset]);

  useEffect(() => {
    if (!days.some((d) => d.key === selected)) {
      const today = days.find((d) => d.key === dayKey(Date.now()));
      setSelected((today ?? days[0]).key);
    }
  }, [days, selected]);

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of (data ?? []) as any[]) {
      (map[dayKey(e.start_time)] ||= []).push(e);
    }
    Object.values(map).forEach((list) => list.sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)));
    return map;
  }, [data]);

  async function start(event: any) {
    setBusy(event.id);
    setActionError("");
    try {
      await unlockAudio();
      const loc = await getLocation();
      const res = await api.startLessonAttendance(event.id, loc as any);
      router.push(`/lessons/${event.id}?session=${res.session.id}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const todayKey = dayKey(Date.now());
  const first = days[0];
  const last = days[6];
  const rangeLabel = `${first.date} ${MONTHS_SHORT[first.month]} – ${last.date} ${MONTHS_SHORT[last.month]}`;

  const card = (e: any, compact = false) => {
    const col = courseColor(e.course);
    const info = typeInfo(e.event_type);
    const live = new Date(e.start_time).getTime() <= tick && new Date(e.end_time).getTime() > tick;
    const canStart = teacher && e.event_type === "lesson" && tick >= new Date(e.start_time).getTime() - 10 * 60_000 && tick < new Date(e.end_time).getTime();
    return (
      <article
        key={e.id}
        className={cn("rounded-2xl border bg-white p-3.5 shadow-card", live && "ring-2 ring-gold-400")}
        style={{ borderLeft: `4px solid ${e.event_type === "assignment_deadline" ? "#f59e0b" : col.dot}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
            {fmtTime(e.start_time)}
            {e.event_type !== "assignment_deadline" && `–${fmtTime(e.end_time)}`}
          </p>
          {live ? <Pill tone="green" dot>Hozir</Pill> : !(compact && e.event_type === "lesson") && <Pill tone={info.tone}>{info.label}</Pill>}
        </div>
        <h3 className={cn("mt-1.5 font-semibold leading-snug text-navy-900", compact ? "text-[13px]" : "text-sm")}>{e.title}</h3>
        {e.room && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} /> {e.room}
          </p>
        )}
        {canStart && (
          <button
            onClick={() => start(e)}
            disabled={busy === e.id}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            <Play size={14} /> {busy === e.id ? "Boshlanmoqda…" : "Davomatni boshlash"}
          </button>
        )}
      </article>
    );
  };

  const selectedEvents = byDay[selected] ?? [];

  return (
    <Page wide>
      <PageHeader
        eyebrow="Dars jadvali"
        title="Haftalik jadval"
        description="Darslar, imtihonlar va topshiriq muddatlari bir joyda."
        actions={
          <div className="flex items-center gap-1 rounded-2xl border bg-white p-1 shadow-card">
            <button aria-label="Oldingi hafta" onClick={() => setOffset(offset - 1)} className="grid size-9 place-items-center rounded-xl hover:bg-slate-50">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setOffset(0)} className="min-w-[132px] px-2 text-center text-sm font-semibold text-navy-800">
              {rangeLabel}
            </button>
            <button aria-label="Keyingi hafta" onClick={() => setOffset(offset + 1)} className="grid size-9 place-items-center rounded-xl hover:bg-slate-50">
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {actionError && <div className="mb-4"><ErrorNote message={actionError} /></div>}
      {loading ? (
        <PageSkeleton rows={2} />
      ) : (
        <>
          {/* Mobil: kun tanlash */}
          <div className="md:hidden">
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
              {days.map((d) => {
                const active = d.key === selected;
                const n = (byDay[d.key] ?? []).length;
                return (
                  <button
                    key={d.key}
                    onClick={() => setSelected(d.key)}
                    className={cn(
                      "flex w-[58px] shrink-0 flex-col items-center rounded-2xl border py-2.5 transition",
                      active ? "border-navy-700 bg-navy-700 text-white shadow-lift" : "bg-white text-navy-800",
                    )}
                  >
                    <span className={cn("text-[11px] font-medium", active ? "text-gold-300" : "text-muted-foreground")}>{d.wd}</span>
                    <span className="font-heading text-lg font-semibold">{d.date}</span>
                    <span className={cn("mt-0.5 size-1.5 rounded-full", n ? (active ? "bg-gold-400" : "bg-gold-500") : "bg-transparent")} />
                  </button>
                );
              })}
            </div>
            <p className="mb-3 mt-1 text-sm font-semibold text-navy-900">{fmtDayLong(Date.parse(selected + "T12:00:00+05:00"))}</p>
            <div className="space-y-3">
              {selectedEvents.length ? selectedEvents.map((e) => card(e)) : <Empty icon={Sparkles} title="Bu kunda mashg‘ulot yo‘q" text="Boshqa kunni tanlang yoki dam oling." />}
            </div>
          </div>

          {/* Desktop: hafta taxtasi */}
          <div className="hidden gap-3 md:grid md:grid-cols-6">
            {days.map((d, i) => {
              const list = byDay[d.key] ?? [];
              const isToday = d.key === todayKey;
              return (
                <section key={d.key} className={cn("min-w-0 rounded-2xl bg-slate-50/80 p-2.5", i === 6 && !list.length && "hidden", isToday && "bg-gold-50 ring-1 ring-gold-200")}>
                  <header className="mb-2.5 flex items-baseline justify-between px-1.5">
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", isToday ? "text-gold-700" : "text-muted-foreground")}>{d.wd}</span>
                    <span className={cn("font-heading text-lg font-semibold", isToday ? "text-gold-700" : "text-navy-900")}>{d.date}</span>
                  </header>
                  <div className="space-y-2.5">
                    {list.length ? list.map((e) => card(e, true)) : <p className="px-2 py-6 text-center text-xs text-slate-400">Bo‘sh kun</p>}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ClipboardCheck size={14} /> Dars</span>
            <span className="inline-flex items-center gap-1.5"><FileWarning size={14} /> Imtihon / dedlayn</span>
          </div>
        </>
      )}
    </Page>
  );
}
