"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  ListFilter,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import * as api from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { AttendanceBroadcastPanel } from "@/components/attendance-broadcast-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

const statusLabels: Record<string, string> = {
  present: "Keldi",
  late: "Kech qoldi",
  absent: "Kelmadi",
  excused: "Sababli",
};

const sourceLabels: Record<string, string> = {
  qr: "QR",
  ultrasound: "Ultrasound",
  manual: "Qo‘lda",
  system: "Tizim",
};

export default function LessonSessionPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = Number(params.id);

  const [event, setEvent] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [tab, setTab] = useState<"attendance" | "roster">("attendance");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const reloadRecords = useCallback(
    async (sessionId?: number, courseId?: number) => {
      const sid = sessionId || session?.id;
      const cid = courseId || session?.course;
      if (!sid) return;
      const [recordData, studentData] = await Promise.all([
        api.getAttendanceRecords(sid),
        cid ? api.getCourseStudents(cid) : Promise.resolve([]),
      ]);
      setRecords(recordData);
      setStudents(studentData);
      setMarks(
        Object.fromEntries(
          recordData.map((row: any) => [Number(row.student), row.status]),
        ),
      );
    },
    [session?.id, session?.course],
  );

  const load = useCallback(async () => {
    try {
      const data = await api.getLessonAttendance(eventId);
      setEvent(data.event);
      setSession(data.session);
      if (data.session) {
        await reloadRecords(data.session.id, data.session.course);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [eventId, reloadRecords]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 4000);
    const clock = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    if (!session?.ended_at) return;
    const timer = window.setTimeout(() => router.replace("/my-courses"), 1500);
    return () => window.clearTimeout(timer);
  }, [session?.ended_at, router]);

  const total = students.length || session?.student_count || 0;
  const presentCount = records.filter((r) => r.status === "present").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const excusedCount = records.filter((r) => r.status === "excused").length;
  const checkedCount = presentCount + lateCount;
  const notCheckedCount = Math.max(total - checkedCount - excusedCount, 0);
  const attendanceOpen =
    session &&
    !session.ended_at &&
    Date.now() <= new Date(session.check_in_ends_at).getTime();

  const checkedRows = useMemo(
    () =>
      records
        .filter((row) => row.status === "present" || row.status === "late")
        .sort(
          (a, b) =>
            new Date(a.checked_at || 0).getTime() -
            new Date(b.checked_at || 0).getTime(),
        ),
    [records],
  );

  const roster = useMemo(() => {
    return students.filter((student) => {
      const value = marks[student.id] || "";
      const text =
        `${student.fullname} ${student.student_id || ""} ${student.phone_number || ""}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesFilter = filter === "all" || value === filter;
      return matchesQuery && matchesFilter;
    });
  }, [students, marks, query, filter]);

  async function setManualStatus(studentId: number, status: string) {
    if (!session) return;
    setMarks((current) => ({ ...current, [studentId]: status }));
    setSaving(studentId);
    setError("");
    try {
      await api.markAttendanceStudent(
        session.id,
        studentId,
        status as "present" | "late" | "absent" | "excused",
      );
      await reloadRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await reloadRecords();
    } finally {
      setSaving(null);
    }
  }

  if (!session && !error) {
    return (
      <ProtectedRoute>
        <main className="workspace-page">
          <p>Dars sessiyasi yuklanmoqda…</p>
        </main>
      </ProtectedRoute>
    );
  }

  if (!session) {
    return (
      <ProtectedRoute>
        <main className="workspace-page">
          <Alert variant="destructive">
            <AlertDescription>
              {error || "Bu dars hali boshlanmagan."}
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => router.push("/my-courses")}>
            Darslarimga qaytish
          </Button>
        </main>
      </ProtectedRoute>
    );
  }

  const lessonStart = new Date(event?.start_time || session.starts_at);
  const lessonEnd = new Date(session.lesson_ends_at);
  const periodLabel = event?.period ? `${event.period}-para` : "Dars";
  const timeLabel = `${lessonStart.toLocaleTimeString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  })}–${lessonEnd.toLocaleTimeString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">DARS SESSIYASI</p>
            <h1>
              {event?.title || session.topic} —{" "}
              {event?.for_group || event?.course_title || session.course_title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock3 size={15} />
                {timeLabel}
              </span>
              <span>{periodLabel}</span>
              <span className="flex items-center gap-1.5">
                <MapPin size={15} />
                {event?.room || "Xona belgilanmagan"}
              </span>
            </div>
          </div>
          <span className="status-badge done">
            {session.ended_at
              ? "Dars yakunlandi"
              : attendanceOpen
                ? "Dars davom etmoqda"
                : "Davomat yopildi · dars davom etmoqda"}
          </span>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-card p-5">
            <Users className="mb-2 text-primary" size={21} />
            <p className="text-sm text-muted-foreground">Jami talabalar</p>
            <strong className="text-2xl">{total} ta</strong>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <CheckCircle2 className="mb-2 text-emerald-600" size={21} />
            <p className="text-sm text-muted-foreground">O‘tganlar</p>
            <strong className="text-2xl">{checkedCount} ta</strong>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <Clock3 className="mb-2 text-amber-600" size={21} />
            <p className="text-sm text-muted-foreground">Kech qolganlar</p>
            <strong className="text-2xl">{lateCount} ta</strong>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <ListFilter className="mb-2 text-rose-600" size={21} />
            <p className="text-sm text-muted-foreground">Hali o‘tmaganlar</p>
            <strong className="text-2xl">{notCheckedCount} ta</strong>
          </div>
        </div>

        <div className="mb-4 flex max-w-md rounded-xl border bg-card p-1">
          <Button
            className="flex-1"
            variant={tab === "attendance" ? "default" : "ghost"}
            onClick={() => setTab("attendance")}
          >
            Davomat
          </Button>
          <Button
            className="flex-1"
            variant={tab === "roster" ? "default" : "ghost"}
            onClick={() => setTab("roster")}
          >
            Ro‘yxat
          </Button>
        </div>

        {tab === "attendance" ? (
          <div className="attendance-layout grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="rounded-2xl border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">O‘tganlar ro‘yxati</h2>
                <p className="text-sm text-muted-foreground">
                  Hozircha avtomatik yoki qo‘lda kelgan deb belgilangan
                  talabalar. {checkedCount} / {total}.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">#</th>
                      <th className="p-3">Talaba</th>
                      <th className="p-3">ID</th>
                      <th className="p-3">Usul</th>
                      <th className="p-3">Vaqt</th>
                      <th className="p-3">Holat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkedRows.map((row, index) => {
                      const student = students.find(
                        (item) => item.id === row.student,
                      );
                      return (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="p-3">{index + 1}</td>
                          <td className="p-3 font-medium">{row.student_name}</td>
                          <td className="p-3 text-muted-foreground">
                            {student?.student_id || event?.for_group || "—"}
                          </td>
                          <td className="p-3">
                            {sourceLabels[row.source] || row.source}
                          </td>
                          <td className="p-3">
                            {row.checked_at
                              ? new Date(row.checked_at).toLocaleTimeString(
                                  "uz-UZ",
                                  { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" },
                                )
                              : "—"}
                          </td>
                          <td className="p-3">
                            <span
                              className={
                                row.status === "late"
                                  ? "status-badge pending"
                                  : "status-badge done"
                              }
                            >
                              {statusLabels[row.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!checkedRows.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Hali hech kim davomatdan o‘tmagan.
                  </p>
                )}
              </div>
            </section>

            {attendanceOpen ? (
              <AttendanceBroadcastPanel
                sessionId={session.id}
                onChanged={() => reloadRecords()}
              />
            ) : (
              <aside className="rounded-2xl border bg-card p-5">
                <h2 className="text-lg font-semibold">Davomat oynasi yopildi</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Avtomatik QR/ultrasound qabul qilish tugadi. Telefonsiz yoki
                  qurilmasi ishlamagan talabalarni “Ro‘yxat” bo‘limidan qo‘lda
                  belgilang.
                </p>
                <Button className="mt-4" onClick={() => setTab("roster")}>
                  Ro‘yxatni ochish
                </Button>
              </aside>
            )}
          </div>
        ) : (
          <div className="attendance-layout grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-2xl border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Talabalar ro‘yxati</h2>
                <p className="text-sm text-muted-foreground">
                  Qidirish va telefonsiz talabalarni qo‘lda belgilash mumkin.
                </p>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <div className="relative min-w-[260px] flex-1">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    className="pl-9"
                    placeholder="Talabani qidiring…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {[
                  ["all", "Barchasi"],
                  ["present", "Keldi"],
                  ["late", "Kech qoldi"],
                  ["absent", "Kelmadi"],
                  ["excused", "Sababli"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={filter === value ? "default" : "outline"}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                {roster.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <div className="min-w-[210px]">
                      <strong>{student.fullname}</strong>
                      <div className="text-xs text-muted-foreground">
                        {student.student_id || event?.for_group || "ID yo‘q"} ·{" "}
                        {student.phone_number || "Telefon kiritilmagan"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ["present", "Keldi"],
                        ["late", "Kech qoldi"],
                        ["absent", "Kelmadi"],
                        ["excused", "Sababli"],
                      ].map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={
                            marks[student.id] === value
                              ? value === "absent"
                                ? "destructive"
                                : "default"
                              : "outline"
                          }
                          disabled={saving !== null || Boolean(session.ended_at)}
                          onClick={() => setManualStatus(student.id, value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
                {!roster.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Mos talaba topilmadi.
                  </p>
                )}
              </div>
            </section>

            <aside className="h-fit rounded-2xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Dars holati</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Jami</span>
                  <strong>{total}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Avtomatik o‘tgan</span>
                  <strong>
                    {
                      records.filter((row) =>
                        ["qr", "ultrasound"].includes(row.source),
                      ).length
                    }
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Qo‘lda belgilangan</span>
                  <strong>
                    {records.filter((row) => row.source === "manual").length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Hali o‘tmagan</span>
                  <strong>{notCheckedCount}</strong>
                </div>
              </div>
              <Button
                className="mt-5 w-full"
                variant="outline"
                onClick={() => setTab("attendance")}
              >
                Davomat oynasiga qaytish
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Dars {lessonEnd.toLocaleTimeString("uz-UZ", {
                  timeZone: "Asia/Tashkent",
                  hour: "2-digit",
                  minute: "2-digit",
                })} da avtomatik yakunlanadi.
              </p>
            </aside>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
