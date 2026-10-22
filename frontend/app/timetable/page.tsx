"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList, MapPin, QrCode, Radio, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { DEMO_MODE } from "@/lib/demo-api";
import * as api from "@/lib/api-service";
import { ErrorNote, Page, PageHeader, PageSkeleton, Pill, settle, useLoad } from "@/components/mu/kit";
import { WEEKDAYS_LONG, courseColor, dayKey, dayKeyFromUtcMidnight, fmtTime, weekStart as weekStartMs } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS = [
  { n: 1, time: "08:00–09:10" },
  { n: 2, time: "09:20–10:30" },
  { n: 3, time: "10:40–11:50" },
  { n: 4, time: "12:30–13:40" },
  { n: 5, time: "13:50–15:00" },
  { n: 6, time: "15:10–16:20" },
  { n: 7, time: "16:30–17:40" },
];

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

export default function TimetablePage() {
  return (
    <ProtectedRoute>
      <Inner />
    </ProtectedRoute>
  );
}

function Inner() {
  const { user } = useAuth();
  const router = useRouter();
  const teacher = user?.role === "ustoz" || user?.role === "admin";
  const { data, loading, error, reload } = useLoad(() =>
    settle({ events: () => api.getCalendar(), sessions: teacher ? api.getAttendanceSessions : async () => [] }),
  );
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
    return Array.from({ length: 6 }, (_, i) => {
      const ms = start + i * 86_400_000;
      const d = new Date(ms);
      return { key: dayKeyFromUtcMidnight(ms), name: WEEKDAYS_LONG[(i + 1) % 7], date: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
    });
  }, [offset]);

  useEffect(() => {
    if (!days.some((d) => d.key === selected)) setSelected((days.find((d) => d.key === dayKey(Date.now())) ?? days[0]).key);
  }, [days, selected]);

  const sessionByEvent = useMemo(() => {
    const m = new Map<number, any>();
    ((data?.sessions ?? []) as any[]).forEach((s) => s.calendar_event && m.set(s.calendar_event, s));
    return m;
  }, [data]);

  const lessons = useMemo(() => ((data?.events ?? []) as any[]).filter((e) => e.event_type === "lesson"), [data]);
  const cellOf = (key: string, n: number) => lessons.filter((e) => dayKey(e.start_time) === key && Number(e.period) === n);
  const loose = (key: string) => lessons.filter((e) => dayKey(e.start_time) === key && !PERIODS.some((p) => p.n === Number(e.period)));

  async function start(event: any) {
    setBusy(event.id);
    setActionError("");
    try {
      const loc = await getLocation();
      const res = await api.startLessonAttendance(event.id, loc as any);
      router.push(`/lessons/${event.id}?session=${res.session.id}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const card = (e: any) => {
    const col = courseColor(e.course);
    const now = new Date(e.start_time).getTime() <= tick && new Date(e.end_time).getTime() > tick;
    const canStart = teacher && tick >= new Date(e.start_time).getTime() - 10 * 60_000 && tick < new Date(e.end_time).getTime();
    const hasSession = sessionByEvent.has(e.id);
    return (
      <article key={e.id} className={cn("flex h-full flex-col rounded-xl border bg-white p-2.5 text-left shadow-sm", now && "ring-2 ring-emerald-500")} style={{ borderLeft: `3px solid ${col.dot}` }}>
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {now && <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"><Radio size={9} /> Hozir</span>}
          {hasSession && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">QR ✓</span>}
        </div>
        <p className="text-[12.5px] font-semibold leading-snug text-navy-900">{e.title}</p>
        <span className={cn("mt-1 w-fit rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", e.lesson_type === "seminar" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700")}>
          {e.lesson_type === "seminar" ? "Seminar" : "Ma’ruza"}
        </span>
        <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground"><Users size={11} className="mt-0.5 shrink-0" /> {e.for_group || "Guruh"}</p>
        <p className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground"><MapPin size={11} className="mt-0.5 shrink-0" /> {e.room || "—"}</p>
        {teacher && (
          <div className="mt-auto flex flex-col gap-1.5 pt-2.5 lg:flex-col">
            <button
              onClick={() => (hasSession && !canStart ? router.push(`/lessons/${e.id}?session=${sessionByEvent.get(e.id).id}`) : start(e))}
              disabled={busy === e.id || (!canStart && !hasSession)}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-navy-700 px-2 py-1.5 text-[10.5px] font-semibold text-white transition hover:bg-navy-800 disabled:bg-slate-200 disabled:text-slate-400"
              title={!canStart && !hasSession ? "Dars vaqtida (10 daqiqa oldin) ochiladi" : undefined}
            >
              <QrCode size={12} /> {busy === e.id ? "…" : "Davomat QR"}
            </button>
            <button onClick={() => router.push(`/lessons/${e.id}${hasSession ? `?session=${sessionByEvent.get(e.id).id}` : ""}`)} className="flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10.5px] font-semibold text-navy-700 hover:bg-navy-50">
              <ClipboardList size={12} /> Ro‘yxat
            </button>
          </div>
        )}
      </article>
    );
  };

  const first = days[0];
  const last = days[5];
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayKey = dayKey(Date.now());

  return (
    <Page wide>
      <PageHeader
        eyebrow={teacher ? "Ta’lim" : "Jadval"}
        title="Dars jadvali"
        description="Para bo‘yicha haftalik jadval. Dars vaqtida davomat QR kodini shu yerdan oching."
        actions={
          <div className="flex items-center gap-1 rounded-2xl border bg-white p-1 shadow-card">
            <button aria-label="Oldingi hafta" onClick={() => setOffset(offset - 1)} className="grid size-9 place-items-center rounded-xl hover:bg-slate-50"><ChevronLeft size={18} /></button>
            <button onClick={() => setOffset(0)} className="min-w-[210px] px-2 text-center text-sm font-semibold text-navy-800">
              {pad(first.date)}-{pad(first.month)}-{first.year} — {pad(last.date)}-{pad(last.month)}-{last.year}
            </button>
            <button aria-label="Keyingi hafta" onClick={() => setOffset(offset + 1)} className="grid size-9 place-items-center rounded-xl hover:bg-slate-50"><ChevronRight size={18} /></button>
          </div>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {actionError && <div className="mb-4"><ErrorNote message={actionError} /></div>}
      {loading ? (
        <PageSkeleton rows={2} />
      ) : (
        <>
          {/* Jadvaldan tashqari (davomiy) darslar */}
          {days.some((d) => loose(d.key).length) && (
            <section className="mb-5 rounded-2xl border border-gold-200 bg-gold-50/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold-800">Parasiz / davomiy darslar</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {days.flatMap((d) => loose(d.key)).map((e) => (
                  <div key={e.id}>
                    <p className="mb-1 text-[11px] text-muted-foreground">{new Date(e.end_time).getTime() - new Date(e.start_time).getTime() > 8 * 3600_000 ? `${fmtTime(e.start_time)} dan · 24 soat ochiq` : `${fmtTime(e.start_time)}–${fmtTime(e.end_time)}`}</p>
                    {card(e)}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Mobil: kunlar bo'yicha */}
          <div className="lg:hidden">
            <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
              {days.map((d) => (
                <button key={d.key} onClick={() => setSelected(d.key)} className={cn("shrink-0 rounded-2xl border px-3.5 py-2 text-center", d.key === selected ? "border-navy-700 bg-navy-700 text-white" : "bg-white", d.key === todayKey && d.key !== selected && "border-gold-400")}>
                  <p className="text-[11px] opacity-80">{d.name.slice(0, 3)}</p>
                  <p className="font-heading text-base font-semibold">{d.date}</p>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {PERIODS.map((p) => {
                const list = cellOf(selected, p.n);
                if (!list.length) return null;
                return (
                  <div key={p.n}>
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{p.n}-para · {p.time}</p>
                    <div className="space-y-2">{list.map(card)}</div>
                  </div>
                );
              })}
              {!PERIODS.some((p) => cellOf(selected, p.n).length) && <p className="rounded-2xl border border-dashed bg-white/60 p-8 text-center text-sm text-muted-foreground">Bu kunda para darslari yo‘q.</p>}
            </div>
          </div>

          {/* Desktop: para jadvali */}
          <div className="thin-scroll hidden overflow-x-auto rounded-2xl border bg-white p-3 shadow-card lg:block">
            <div className="grid min-w-[1320px] gap-1.5" style={{ gridTemplateColumns: "92px repeat(7, minmax(0,1fr))" }}>
              <div className="grid place-items-center rounded-lg bg-navy-700 py-3 text-xs font-semibold text-white">Kun</div>
              {PERIODS.map((p) => (
                <div key={p.n} className="rounded-lg bg-navy-700 py-2 text-center text-white">
                  <p className="font-heading text-sm font-semibold">{p.n}</p>
                  <p className="text-[10px] text-navy-200">{p.time}</p>
                </div>
              ))}
              {days.map((d) => {
                const today = d.key === todayKey;
                return (
                  <div key={d.key} className="contents">
                    <div className={cn("grid place-items-center rounded-lg px-1 py-3 text-center", today ? "bg-gold-500 text-navy-950" : "bg-slate-100 text-navy-800")}>
                      <div>
                        <p className="text-xs font-bold">{d.name}</p>
                        <p className="text-[11px] opacity-70">{pad(d.date)}.{pad(d.month)}</p>
                      </div>
                    </div>
                    {PERIODS.map((p) => {
                      const list = cellOf(d.key, p.n);
                      return (
                        <div key={p.n} className={cn("min-h-[132px] space-y-1.5 rounded-lg p-1", today ? "bg-gold-50/70" : "bg-slate-50/60")}>
                          {list.map(card)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          {!teacher && <div className="mt-3"><Pill>Talabalar uchun faqat ko‘rish rejimi</Pill></div>}
        </>
      )}
    </Page>
  );
}
