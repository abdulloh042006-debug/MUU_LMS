"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Play,
  Users,
} from "lucide-react";
import * as api from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const days = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
];

const periods = [
  { period: 1, label: "1-para", time: "08:00–09:10" },
  { period: 2, label: "2-para", time: "09:20–10:30" },
  { period: 3, label: "3-para", time: "10:40–11:50" },
  { period: 4, label: "4-para", time: "12:00–13:10" },
  { period: 5, label: "5-para", time: "13:20–14:30" },
  { period: 6, label: "6-para", time: "14:40–15:50" },
];

const campusZone = "Asia/Tashkent";
const campusCalendar = new Intl.DateTimeFormat("en-US", {
  timeZone: campusZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function campusDayKey(date: Date) {
  const parts = campusCalendar.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function calendarDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function campusToday() {
  const [year, month, day] = campusDayKey(new Date()).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function mondayFor(date = campusToday()) {
  const d = new Date(date);
  const day = d.getDay();
  const delta = day === 0 ? 1 : 1 - day;
  d.setDate(d.getDate() + delta);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, amount: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function eventOnDay(event: any, day: Date) {
  return campusDayKey(new Date(event.start_time)) === calendarDayKey(day);
}

function shortDate(date: Date) {
  return date.toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "short",
  });
}

function lessonTime(event: any) {
  const format = (value: string) => new Date(value).toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });
  return `${format(event.start_time)}–${format(event.end_time)}`;
}

function getLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Lokatsiya xizmati topilmadi."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () =>
        reject(
          new Error(
            "Darsni boshlash uchun lokatsiyaga ruxsat bering va GPSni yoqing.",
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  });
}

async function unlockAttendanceAudio() {
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtor) return;
  const w = window as Window & {
    __muuAttendanceAudioContext?: AudioContext;
  };
  const context = w.__muuAttendanceAudioContext || new AudioCtor();
  w.__muuAttendanceAudioContext = context;
  await context.resume().catch(() => undefined);
}

function lessonAvailability(event: any, now: number) {
  if (now < new Date(event.start_time).getTime() - 10 * 60 * 1000) return "early";
  if (now >= new Date(event.end_time).getTime()) return "ended";
  return "ready";
}

function lessonButtonLabel(event: any, now: number, compact = false) {
  const state = lessonAvailability(event, now);
  if (state === "ended") return "Vaqti tugagan";
  if (state === "early") return "Hali erta";
  return compact ? "Boshlash" : "Darsni boshlash";
}

export default function LessonsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [weekStart, setWeekStart] = useState(() => mondayFor());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [mobileDay, setMobileDay] = useState(() => {
    const weekday = campusToday().getDay();
    return weekday >= 1 && weekday <= 6 ? weekday - 1 : 0;
  });

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api
      .getCalendar()
      .then((data) =>
        setEvents(
          data.filter(
            (event: any) => event.event_type === "lesson" && event.course,
          ),
        ),
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 6 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const weekEvents = useMemo(
    () => events.filter((event) => weekDays.some((day) => eventOnDay(event, day))),
    [events, weekDays],
  );

  const extraWeekEvents = useMemo(() => {
    const occupied = new Set<string>();
    return weekEvents.filter((event) => {
      const period = Number(event.period);
      if (!periods.some((slot) => slot.period === period)) return true;
      const key = `${campusDayKey(new Date(event.start_time))}-${period}`;
      if (occupied.has(key)) return true;
      occupied.add(key);
      return false;
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [weekEvents]);

  const todayEvents = events.filter((event) => eventOnDay(event, campusToday()));
  const nextEvent = [...events]
    .filter((event) => new Date(event.end_time).getTime() > currentTime)
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    )[0];
  const activeEvent = todayEvents.find(
    (event) =>
      new Date(event.start_time).getTime() <= currentTime &&
      new Date(event.end_time).getTime() > currentTime,
  );

  async function startLesson(event: any) {
    if (lessonAvailability(event, Date.now()) !== "ready") {
      setError("Darsni faqat boshlanishidan 10 daqiqa oldin yoki dars davomida boshlash mumkin.");
      return;
    }
    setStarting(event.id);
    setError("");
    try {
      await unlockAttendanceAudio();
      const location = await getLocation();
      const response = await api.startLessonAttendance(event.id, location);
      router.push(
        `/lessons/${event.id}?session=${response.session.id}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(null);
    }
  }

  const teacher = user?.role === "ustoz" || user?.role === "admin";

  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">
              {teacher ? "TA’LIM JARAYONINI BOSHQARING" : "HAFTALIK DARS JADVALI"}
            </p>
            <h1>Darslarim</h1>
            <p>
              {teacher
                ? "Haftalik dars jadvali va jurnal. Dars vaqtida davomatni shu yerdan boshlaysiz."
                : "Qaysi kuni qaysi para borligini, xona va fan ma’lumotlarini shu yerda ko‘ring."}
            </p>
          </div>
        </div>

        {teacher && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Jadvaldagi dars faqat o‘z vaqtida boshlanadi. Hozir sinash uchun alohida davomat mashg‘ulotini oching.
            </p>
            <Button asChild variant="outline">
              <Link href="/manage?tab=attendance">Hozir sinov davomatini boshlash</Link>
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Bugungi darslar</p>
                <strong className="text-2xl">{todayEvents.length} ta</strong>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Clock3 className="text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Keyingi dars</p>
                <strong className="block text-lg">
                  {nextEvent
                    ? new Date(nextEvent.start_time).toLocaleTimeString(
                        "uz-UZ",
                        { hour: "2-digit", minute: "2-digit", timeZone: campusZone },
                      )
                    : "—"}
                </strong>
                <span className="text-sm text-muted-foreground">
                  {nextEvent?.title || "Rejalashtirilmagan"}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Users className="text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Joriy haftadagi darslar
                </p>
                <strong className="text-2xl">{weekEvents.length} ta</strong>
              </div>
            </div>
          </div>
        </div>

        {teacher && activeEvent && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div>
              <p className="text-sm font-medium text-emerald-700">Hozir dars vaqti</p>
              <h2 className="text-xl font-semibold">{activeEvent.title}</h2>
              <p className="text-sm text-muted-foreground">
                {activeEvent.for_group || activeEvent.course_title} · {activeEvent.room || "Xona belgilanmagan"}
              </p>
            </div>
            <Button
              disabled={starting !== null}
              onClick={() => startLesson(activeEvent)}
            >
              <Play size={16} />
              {starting === activeEvent.id ? "Boshlanmoqda…" : "Darsni boshlash"}
            </Button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                aria-label="Oldingi hafta"
              >
                <ChevronLeft size={18} />
              </Button>
              <strong>
                {shortDate(weekDays[0])} – {shortDate(weekDays[5])}
              </strong>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                aria-label="Keyingi hafta"
              >
                <ChevronRight size={18} />
              </Button>
            </div>
            <Button variant="outline" onClick={() => setWeekStart(mondayFor())}>
              Bugun
            </Button>
          </div>

          {loading ? (
            <p className="p-6">Dars jadvali yuklanmoqda…</p>
          ) : (
            <>
              <div className="schedule-mobile">
                <div className="schedule-mobile-days" aria-label="Hafta kunlari">
                  {weekDays.map((day, index) => (
                    <button
                      type="button"
                      key={day.toISOString()}
                      className={mobileDay === index ? "active" : ""}
                      onClick={() => setMobileDay(index)}
                    >
                      <span>{days[index].slice(0, 3)}</span>
                      <strong>{day.getDate()}</strong>
                    </button>
                  ))}
                </div>
                <div className="schedule-mobile-list">
                  {periods.map((slot) => {
                    const selectedDay = weekDays[mobileDay];
                    const event = weekEvents.find(
                      (item) =>
                        Number(item.period) === slot.period &&
                        eventOnDay(item, selectedDay),
                    );
                    return (
                      <article
                        key={slot.period}
                        className={`schedule-mobile-row ${event ? "has-lesson" : "is-empty"}`}
                      >
                        <div className="schedule-mobile-period">
                          <strong>{slot.label}</strong>
                          <span>{event ? lessonTime(event) : slot.time}</span>
                        </div>
                        {event ? (
                          <div className="schedule-mobile-lesson">
                            <div>
                              <strong>{event.title}</strong>
                              <p>{event.for_group || event.course_title}</p>
                              <span>
                                <MapPin size={13} />
                                {event.room || "Xona belgilanmagan"}
                              </span>
                            </div>
                            {teacher ? (
                              <Button
                                size="sm"
                                disabled={starting !== null || lessonAvailability(event, currentTime) !== "ready"}
                                onClick={() => startLesson(event)}
                              >
                                <Play size={14} />
                                {starting === event.id ? "..." : lessonButtonLabel(event, currentTime, true)}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  router.push(`/courses?course=${event.course}`)
                                }
                              >
                                Ochish
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="schedule-mobile-empty">Dars yo‘q</div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
              <div className="schedule-desktop overflow-x-auto">
                <div className="min-w-[1120px]">
                <div className="grid grid-cols-[130px_repeat(6,minmax(150px,1fr))] border-b bg-muted/30">
                  <div className="p-3 text-sm font-semibold">Dars vaqti</div>
                  {weekDays.map((day, index) => (
                    <div
                      key={day.toISOString()}
                      className="border-l p-3 text-center"
                    >
                      <strong className="block text-sm">{days[index]}</strong>
                      <span className="text-xs text-muted-foreground">
                        {shortDate(day)}
                      </span>
                    </div>
                  ))}
                </div>

                {periods.map((slot) => (
                  <div
                    key={slot.period}
                    className="grid grid-cols-[130px_repeat(6,minmax(150px,1fr))] border-b last:border-b-0"
                  >
                    <div className="p-3">
                      <strong className="block text-sm">{slot.label}</strong>
                      <span className="text-xs text-muted-foreground">
                        {slot.time}
                      </span>
                    </div>
                    {weekDays.map((day) => {
                      const event = weekEvents.find(
                        (item) =>
                          Number(item.period) === slot.period &&
                          eventOnDay(item, day),
                      );
                      return (
                        <div
                          key={day.toISOString()}
                          className="min-h-[116px] border-l p-2"
                        >
                          {!event ? (
                            <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                              <span>—<br />Dars yo‘q</span>
                            </div>
                          ) : (
                            <div className="h-full rounded-xl border bg-muted/30 p-3">
                              <strong className="block text-sm">
                                {event.title}
                              </strong>
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                <div>{lessonTime(event)}</div>
                                <div>{event.for_group || event.course_title}</div>
                                <div className="flex items-center gap-1">
                                  <MapPin size={12} />
                                  {event.room || "Xona belgilanmagan"}
                                </div>
                              </div>
                              {teacher ? (
                                <Button
                                  size="sm"
                                  className="mt-3 w-full"
                                  disabled={starting !== null || lessonAvailability(event, currentTime) !== "ready"}
                                  onClick={() => startLesson(event)}
                                >
                                  <Play size={14} />
                                  {starting === event.id
                                    ? "Boshlanmoqda…"
                                    : lessonButtonLabel(event, currentTime)}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-3 w-full"
                                  onClick={() =>
                                    router.push(
                                      `/courses?course=${event.course}`,
                                    )
                                  }
                                >
                                  Dars tafsiloti
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {extraWeekEvents.length > 0 && (
              <section className="border-t p-4 md:p-6" aria-label="Qo‘shimcha darslar">
                <h2 className="font-semibold">Qo‘shimcha darslar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Parasi belgilanmagan yoki bir paraga bir nechta dars tushgan mashg‘ulotlar.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {extraWeekEvents.map((event) => (
                    <article key={event.id} className="rounded-xl border p-4">
                      <strong className="block">{event.title}</strong>
                      <p className="mt-1 text-sm">
                        {new Date(event.start_time).toLocaleDateString("uz-UZ", {
                          timeZone: campusZone,
                        })} · {lessonTime(event)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.for_group || event.course_title} · {event.room || "Xona belgilanmagan"}
                      </p>
                      {teacher ? (
                        <Button
                          size="sm"
                          className="mt-3"
                          disabled={starting !== null || lessonAvailability(event, currentTime) !== "ready"}
                          onClick={() => startLesson(event)}
                        >
                          <Play size={14} />
                          {starting === event.id
                                    ? "Boshlanmoqda…"
                                    : lessonButtonLabel(event, currentTime)}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => router.push(`/courses?course=${event.course}`)}
                        >
                          Dars tafsiloti
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
