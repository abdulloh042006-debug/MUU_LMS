"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, MapPin, Plus, Trash2, X } from "lucide-react";
import { AdminPage } from "@/components/mu/admin";
import { createCalendarEvent, getCalendar, getCourses, getGroups, removeEvent } from "@/lib/api-service";
import { ErrorNote, Notice, Page, PageHeader, PageSkeleton, settle, useLoad } from "@/components/mu/kit";
import { WEEKDAYS_LONG, courseColor, dayKey, dayKeyFromUtcMidnight, weekStart as weekStartMs } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS = [
  { n: 1, s: "08:00", e: "09:10" },
  { n: 2, s: "09:20", e: "10:30" },
  { n: 3, s: "10:40", e: "11:50" },
  { n: 4, s: "12:30", e: "13:40" },
  { n: 5, s: "13:50", e: "15:00" },
  { n: 6, s: "15:10", e: "16:20" },
  { n: 7, s: "16:30", e: "17:40" },
];
const field = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200";
const addDays = (key: string, n: number) => dayKeyFromUtcMidnight(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000);

export default function ScheduleEditor() {
  const { data, loading, error, reload } = useLoad(() => settle({ events: getCalendar, courses: getCourses, groups: getGroups }));
  const [offset, setOffset] = useState(0);
  const [group, setGroup] = useState("");
  const [slot, setSlot] = useState<{ day: string; period: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const events = useMemo(() => ((data?.events ?? []) as any[]).filter((e) => e.event_type === "lesson"), [data]);
  const groupCodes = useMemo(() => {
    const fromApi = ((data?.groups ?? []) as any[]).map((g) => g.code);
    const fromEvents = events.flatMap((e) => String(e.for_group || "").split(",").map((x) => x.trim())).filter(Boolean);
    return [...new Set([...fromApi, ...fromEvents])].sort();
  }, [data, events]);
  const busiest = useMemo(() => {
    const count = (g: string) => events.filter((e) => String(e.for_group || "").split(",").map((x) => x.trim()).includes(g)).length;
    return [...groupCodes].sort((a, b) => count(b) - count(a))[0] ?? "";
  }, [groupCodes, events]);
  const current = group || busiest;
  const courses = ((data?.courses ?? []) as any[]).filter((c) => !c.is_archived);

  const days = useMemo(() => {
    const start = weekStartMs(offset);
    return Array.from({ length: 6 }, (_, i) => dayKeyFromUtcMidnight(start + i * 86_400_000));
  }, [offset]);

  const inGroup = (e: any) => String(e.for_group || "").split(",").map((x) => x.trim()).includes(current);
  const cell = (day: string, n: number) => events.filter((e) => inGroup(e) && dayKey(e.start_time) === day && Number(e.period) === n);
  const roomBusy = (day: string, n: number, room: string) => room && events.some((e) => dayKey(e.start_time) === day && Number(e.period) === n && e.room?.toLowerCase() === room.toLowerCase());

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot) return;
    const d = new FormData(e.currentTarget);
    const course = courses.find((c) => String(c.id) === String(d.get("course")));
    const weeks = Math.max(1, Math.min(16, Number(d.get("weeks")) || 1));
    const p = PERIODS.find((x) => x.n === slot.period)!;
    setBusy(true);
    setErr("");
    try {
      for (let w = 0; w < weeks; w++) {
        const day = addDays(slot.day, w * 7);
        await createCalendarEvent({
          course: course?.id,
          title: course?.title ?? "Dars",
          description: `${current} guruhi darsi`,
          event_type: "lesson",
          lesson_type: d.get("lesson_type"),
          start_time: new Date(`${day}T${p.s}:00+05:00`).toISOString(),
          end_time: new Date(`${day}T${p.e}:00+05:00`).toISOString(),
          room: String(d.get("room") || ""),
          period: slot.period,
          for_group: current,
        });
      }
      setNotice(`${course?.title} — ${weeks} hafta uchun jadvalga qo‘shildi.`);
      setSlot(null);
      reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  async function del(e: any) {
    try {
      await removeEvent(e.id);
      reload();
    } catch (x) {
      setNotice(x instanceof Error ? x.message : String(x));
    }
  }

  const first = days[0];
  const last = days[5];

  return (
    <AdminPage>
      <Page wide>
        <PageHeader
          eyebrow="Administrator"
          title="Dars jadvalini tuzish"
          description="Guruhni tanlang, bo‘sh katakni bosib dars qo‘shing. Bir necha hafta uchun takrorlash mumkin."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select value={current} onChange={(e) => setGroup(e.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold shadow-card" aria-label="Guruh">
                {groupCodes.map((g) => <option key={g}>{g}</option>)}
              </select>
              <div className="flex items-center gap-1 rounded-2xl border bg-white p-1 shadow-card">
                <button aria-label="Oldingi hafta" onClick={() => setOffset(offset - 1)} className="grid size-8 place-items-center rounded-xl hover:bg-slate-50"><ChevronLeft size={17} /></button>
                <button onClick={() => setOffset(0)} className="px-2 text-sm font-semibold text-navy-800">{first.slice(8)}.{first.slice(5, 7)} – {last.slice(8)}.{last.slice(5, 7)}</button>
                <button aria-label="Keyingi hafta" onClick={() => setOffset(offset + 1)} className="grid size-8 place-items-center rounded-xl hover:bg-slate-50"><ChevronRight size={17} /></button>
              </div>
            </div>
          }
        />
        {notice && <div className="mb-4 flex items-center justify-between rounded-2xl bg-emerald-50 p-3.5 text-sm text-emerald-800">{notice}<button onClick={() => setNotice("")} aria-label="Yopish"><X size={16} /></button></div>}
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading ? <PageSkeleton rows={2} /> : (
          <div className="thin-scroll overflow-x-auto rounded-2xl border bg-white p-3 shadow-card">
            <div className="grid min-w-[1100px] gap-1.5" style={{ gridTemplateColumns: "92px repeat(7, minmax(0,1fr))" }}>
              <div className="grid place-items-center rounded-lg bg-navy-700 py-3 text-xs font-semibold text-white">{current}</div>
              {PERIODS.map((p) => (
                <div key={p.n} className="rounded-lg bg-navy-700 py-2 text-center text-white">
                  <p className="font-heading text-sm font-semibold">{p.n}</p>
                  <p className="text-[10px] text-navy-200">{p.s}–{p.e}</p>
                </div>
              ))}
              {days.map((day, i) => (
                <div key={day} className="contents">
                  <div className="grid place-items-center rounded-lg bg-slate-100 px-1 py-3 text-center">
                    <div>
                      <p className="text-xs font-bold text-navy-800">{WEEKDAYS_LONG[(i + 1) % 7]}</p>
                      <p className="text-[11px] text-muted-foreground">{day.slice(8)}.{day.slice(5, 7)}</p>
                    </div>
                  </div>
                  {PERIODS.map((p) => {
                    const list = cell(day, p.n);
                    return (
                      <div key={p.n} className="min-h-[96px] rounded-lg bg-slate-50/70 p-1">
                        {list.map((e) => (
                          <div key={e.id} className="group relative mb-1 rounded-lg border bg-white p-2 text-[11px] shadow-sm" style={{ borderLeft: `3px solid ${courseColor(e.course).dot}` }}>
                            <p className="pr-5 font-semibold leading-snug text-navy-900">{e.title}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-muted-foreground"><MapPin size={10} /> {e.room || "—"} · {e.lesson_type === "seminar" ? "Seminar" : "Ma’ruza"}</p>
                            <button onClick={() => del(e)} aria-label="Darsni o‘chirish" className="absolute right-1 top-1 grid size-6 place-items-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={12} /></button>
                          </div>
                        ))}
                        {!list.length && (
                          <button onClick={() => { setSlot({ day, period: p.n }); setErr(""); }} className="grid h-full min-h-[88px] w-full place-items-center rounded-lg border-2 border-dashed border-transparent text-slate-300 transition hover:border-gold-300 hover:bg-gold-50 hover:text-gold-700" aria-label={`${day} ${p.n}-para: dars qo‘shish`}>
                            <Plus size={18} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4"><Notice tone="navy">Dars qo‘shish va o‘chirish haqiqiy backend’dagi taqvim API’si orqali ishlaydi; demo rejimda o‘zgarishlar sahifa yangilanguncha saqlanadi.</Notice></div>

        {slot && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
            <form onSubmit={add} className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-navy-900">{current} · {slot.period}-para</h2>
                <button type="button" onClick={() => setSlot(null)} aria-label="Yopish" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <p className="-mt-2 text-sm text-muted-foreground">{WEEKDAYS_LONG[new Date(`${slot.day}T12:00:00+05:00`).getDay()]}, {slot.day}</p>
              {err && <ErrorNote message={err} />}
              <label className="block text-sm font-medium">Fan<select name="course" required className={`${field} mt-1.5`}>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Turi<select name="lesson_type" className={`${field} mt-1.5`}><option value="lecture">Ma’ruza</option><option value="seminar">Seminar</option></select></label>
                <label className="block text-sm font-medium">Xona<input name="room" required placeholder="A-301" className={`${field} mt-1.5`} onChange={(e) => {
                  const warn = roomBusy(slot.day, slot.period, e.target.value);
                  e.target.setCustomValidity(warn ? "Bu xona shu parada band" : "");
                }} /></label>
              </div>
              <label className="block text-sm font-medium">Necha hafta takrorlansin<input name="weeks" type="number" min={1} max={16} defaultValue={1} className={`${field} mt-1.5`} /></label>
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> Xona shu parada boshqa guruhda band bo‘lsa, saqlashga ruxsat berilmaydi.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSlot(null)} className="h-11 flex-1 rounded-xl border text-sm font-semibold hover:bg-slate-50">Bekor</button>
                <button disabled={busy} className={cn("h-11 flex-1 rounded-xl bg-navy-700 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60")}>{busy ? "Qo‘shilmoqda…" : "Jadvalga qo‘shish"}</button>
              </div>
            </form>
          </div>
        )}
      </Page>
    </AdminPage>
  );
}
