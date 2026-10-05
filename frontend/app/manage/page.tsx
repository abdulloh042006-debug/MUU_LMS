"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import * as api from "@/lib/api-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Download, Trash2, Plus, Users, Check } from "lucide-react";
import { AttendanceBroadcastPanel } from "@/components/attendance-broadcast-panel";

type Row = { id: number; [key: string]: any };
const campusStamp = (value: FormDataEntryValue | null) =>
  new Date(`${String(value)}+05:00`).toISOString();
const campusDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};
const freshLocation = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Qurilmada lokatsiya xizmati topilmadi."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      () =>
        reject(
          new Error(
            "Lokatsiyani olishga ruxsat bering va GPS/location xizmatini yoqing.",
          ),
        ),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000,
      },
    );
  });
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function Management() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const allowed = user?.role === "ustoz" || admin;
  const [teachers, setTeachers] = useState<Row[]>([]);
  const [courses, setCourses] = useState<Row[]>([]),
    [selected, setSelected] = useState(0);
  const [books, setBooks] = useState<Row[]>([]),
    [assignments, setAssignments] = useState<Row[]>([]);
  const [submissions, setSubmissions] = useState<Row[]>([]),
    [events, setEvents] = useState<Row[]>([]);
  const [sessions, setSessions] = useState<Row[]>([]),
    [students, setStudents] = useState<Row[]>([]);
  const [activeSession, setActiveSession] = useState(0),
    [marks, setMarks] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [calendarType, setCalendarType] = useState("lesson");
  const [activeTab, setActiveTab] = useState("courses");
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && ["courses", "materials", "assignments", "grading", "attendance", "calendar"].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);
  const [confirm, setConfirm] = useState<{
    title: string;
    action: () => Promise<any>;
  } | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const load = useCallback(async () => {
    const [c, b, a, s, e, t] = await Promise.all([
      api.getCourses(),
      api.getBooks(),
      api.getAssignments(),
      api.getTeacherSubmissions(),
      api.getCalendar(),
      api.getAttendanceSessions(),
    ]);
    setCourses(c);
    setBooks(b);
    setAssignments(a);
    setSubmissions(s);
    setEvents(e);
    setSessions(t);
    setSelected((old) => {
      if (c.some((item: Row) => item.id === old)) return old;
      const requested = Number(new URLSearchParams(window.location.search).get("course"));
      return c.some((item: Row) => item.id === requested) ? requested : c[0]?.id || 0;
    });
  }, []);
  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [allowed, load]);

  useEffect(() => {
    if (!admin) {
      setTeachers([]);
      return;
    }
    let active = true;
    api
      .getAdminUsers()
      .then((rows) => {
        if (active) {
          setTeachers(
            rows.filter(
              (row: Row) => row.role === "ustoz" && row.is_active !== false,
            ),
          );
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [admin]);

  useEffect(() => {
    setActiveSession(0);
    setMarks({});
    setEditing(null);
    if (!selected) {
      setStudents([]);
      return;
    }
    let active = true;
    api
      .getCourseStudents(selected)
      .then((data) => {
        if (active) setStudents(data);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [selected]);
  useEffect(() => {
    if (!activeSession) {
      setMarks({});
      return;
    }
    let active = true;
    setMarks({});
    api
      .getAttendanceRecords(activeSession)
      .then((data) => {
        if (active)
          setMarks(
            Object.fromEntries(data.map((r: Row) => [r.student, r.status])),
          );
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [activeSession]);
  async function run(action: () => Promise<any>, message = "Saqlandi.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      if (selected) setStudents(await api.getCourseStudents(selected));
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const course = courses.find((c) => c.id === selected);
  const mine = (rows: Row[]) =>
    rows.filter((r) => Number(r.course) === selected);
  const submitForm =
    (action: (d: FormData) => Promise<any>) =>
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = new FormData(form);
      if (await run(() => action(data))) form.reset();
    };
  const courseData = (d: FormData) => {
    d.set("course", String(selected));
    return d;
  };
  const remove = (title: string, action: () => Promise<any>) =>
    setConfirm({ title, action });
  const canCreate = !!selected && !course?.is_archived;
  return (
    <ProtectedRoute>
      {!allowed ? (
        <Alert className="m-6">
          <AlertDescription>
            Bu bo‘lim ustoz va administrator uchun.
          </AlertDescription>
        </Alert>
      ) : (
        <main className="workspace-page">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">TA’LIM JARAYONINI BOSHQARISH</p>
              <h1>Ustoz kabineti</h1>
              <p>Dars, talabalar, topshiriqlar va baholash — bir joyda.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => run(load, "Ma’lumotlar yangilandi.")}
              disabled={busy}
            >
              Yangilash
            </Button>
          </div>
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && (
            <p role="status" className="success-note">
              <Check size={16} />
              {notice}
            </p>
          )}
          {loading ? (
            <p>Yuklanmoqda…</p>
          ) : (
            <>
              <div className="course-picker">
                <Label htmlFor="course-scope">Ishlayotgan darsingiz</Label>
                <select
                  id="course-scope"
                  value={selected}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  <option value="0" disabled>
                    Darsni tanlang
                  </option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                      {c.is_archived ? " (Arxiv)" : ""}
                    </option>
                  ))}
                </select>
                {course && (
                  <span>
                    <Users size={15} />
                    {students.length} talaba
                  </span>
                )}
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="management-tabs">
                  <TabsTrigger value="courses">Dars va talabalar</TabsTrigger>
                  <TabsTrigger value="materials">Materiallar</TabsTrigger>
                  <TabsTrigger value="assignments">Topshiriqlar</TabsTrigger>
                  <TabsTrigger value="grading">Baholash</TabsTrigger>
                  <TabsTrigger value="attendance">Davomat</TabsTrigger>
                  <TabsTrigger value="calendar">Taqvim</TabsTrigger>
                </TabsList>
                <TabsContent value="courses">
                  <div className="management-grid">
                    <Card>
                      <CardHeader>
                        <CardTitle>Yangi dars</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form
                          className="space-y-4"
                          onSubmit={submitForm((d) =>
                            api.createCourse(Object.fromEntries(d)),
                          )}
                        >
                          <Field label="Dars nomi">
                            <Input
                              aria-label="Dars nomi"
                              name="title"
                              required
                              maxLength={150}
                            />
                          </Field>
                          <Field label="Unikal dars kodi">
                            <Input
                              aria-label="Dars kodi"
                              name="code"
                              placeholder="IT102-PYTHON"
                              required
                              maxLength={32}
                            />
                          </Field>
                          <Field label="Tavsif">
                            <Textarea
                              aria-label="Dars tavsifi"
                              name="description"
                            />
                          </Field>
                          {admin && (
                            <Field label="Mas’ul ustoz">
                              <select
                                aria-label="Dars ustozini tanlash"
                                name="teacher"
                                className="native-select"
                                required
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  Ustozni tanlang
                                </option>
                                {teachers.map((teacher) => (
                                  <option key={teacher.id} value={teacher.id}>
                                    {teacher.fullname} · @{teacher.username}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          )}
                          <Button disabled={busy || (admin && !teachers.length)}>
                            <Plus size={16} />
                            Dars yaratish
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {course?.title || "Dars tanlanmagan"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {course && (
                          <>
                            <p>
                              {course.description ||
                                "Dars tavsifi hali kiritilmagan."}
                            </p>
                            {admin && (
                              <div className="space-y-2">
                                <Label htmlFor="course-teacher">
                                  Mas’ul ustoz
                                </Label>
                                <select
                                  id="course-teacher"
                                  className="native-select"
                                  value={course.teacher || ""}
                                  disabled={busy || !teachers.length}
                                  onChange={(e) =>
                                    run(
                                      () =>
                                        api.updateCourse(selected, {
                                          teacher: Number(e.target.value),
                                        }),
                                      "Dars ustozga biriktirildi.",
                                    )
                                  }
                                >
                                  {teachers.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id}>
                                      {teacher.fullname} · @{teacher.username}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () =>
                                    api.updateCourse(selected, {
                                      is_archived: !course.is_archived,
                                    }),
                                  course.is_archived
                                    ? "Dars tiklandi."
                                    : "Dars arxivlandi. Ma’lumotlar saqlanadi.",
                                )
                              }
                            >
                              {course.is_archived
                                ? "Arxivdan chiqarish"
                                : "Darsni arxivlash"}
                            </Button>
                            <form
                              className="flex flex-wrap gap-2"
                              onSubmit={submitForm((d) =>
                                api.addCourseStudent(
                                  selected,
                                  String(d.get("username")).trim(),
                                ),
                              )}
                            >
                              <Input
                                aria-label="Talaba foydalanuvchi nomi"
                                name="username"
                                placeholder="Talabaning foydalanuvchi nomi"
                                required
                                className="flex-1 min-w-40"
                              />
                              <Button disabled={busy || !canCreate}>
                                Talaba qo‘shish
                              </Button>
                            </form>
                            <p className="text-sm text-muted-foreground">
                              Talaba hisobini avval administrator yaratadi. So‘ng
                              foydalanuvchi nomi orqali darsga qo‘shasiz.
                            </p>
                            <div className="space-y-2">
                              {students.map((s) => (
                                <div className="manage-row" key={s.id}>
                                  <div>
                                    <strong>{s.fullname}</strong>
                                    <small>@{s.username}</small>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`${s.fullname}ni darsdan chiqarish`}
                                    disabled={busy}
                                    onClick={() =>
                                      remove(
                                        `${s.fullname} darsdan chiqarilsinmi?`,
                                        () =>
                                          api.removeCourseStudent(
                                            selected,
                                            s.id,
                                          ),
                                      )
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </div>
                              ))}
                              {!students.length && (
                                <p>Hozircha darsga talaba biriktirilmagan.</p>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                <TabsContent value="materials">
                  <div className="management-grid">
                    <Card>
                      <CardHeader>
                        <CardTitle>Material yuklash</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form
                          className="space-y-4"
                          onSubmit={submitForm((d) =>
                            api.createBook(courseData(d)),
                          )}
                        >
                          <Field label="Material nomi">
                            <Input
                              aria-label="Material nomi"
                              name="title"
                              required
                            />
                          </Field>
                          <Field label="Fan / bo‘lim">
                            <Input
                              aria-label="Material fani"
                              name="subject"
                              required
                            />
                          </Field>
                          <Field label="Fayl — 20 MB gacha">
                            <Input
                              aria-label="Material fayli"
                              type="file"
                              name="file"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip"
                              required
                            />
                          </Field>
                          <Button disabled={busy || !canCreate}>Yuklash</Button>
                        </form>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Dars materiallari</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {mine(books).map((b) => (
                          <div className="manage-row" key={b.id}>
                            <div>
                              <strong>{b.title}</strong>
                              <small>{b.subject}</small>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${b.title}ni yuklab olish`}
                                onClick={() =>
                                  api
                                    .downloadFile(b.file)
                                    .catch((e) => setError(e.message))
                                }
                              >
                                <Download size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${b.title}ni o‘chirish`}
                                disabled={busy}
                                onClick={() =>
                                  remove(`${b.title} o‘chirilsinmi?`, () =>
                                    api.removeBook(b.id),
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {!mine(books).length && (
                          <p>Materiallar hali yuklanmagan.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                <TabsContent value="assignments">
                  <div className="management-grid">
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {editing
                            ? "Topshiriqni tahrirlash"
                            : "Yangi topshiriq"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form
                          key={editing?.id || "new"}
                          className="space-y-4"
                          onSubmit={submitForm(async (d) => {
                            if (editing) {
                              const data = {
                                title: d.get("title"),
                                description: d.get("description"),
                                deadline: campusStamp(d.get("deadline")),
                                max_attempts: Number(d.get("max_attempts")),
                                allow_late: d.get("allow_late") === "on",
                              };
                              const r = await api.updateAssignment(
                                Number(editing.id),
                                data,
                              );
                              setEditing(null);
                              return r;
                            }
                            d.set("deadline", campusStamp(d.get("deadline")));
                            d.set(
                              "allow_late",
                              d.get("allow_late") === "on" ? "true" : "false",
                            );
                            if (!(d.get("file") as File)?.size)
                              d.delete("file");
                            return api.createAssignment(courseData(d));
                          })}
                        >
                          <Field label="Topshiriq nomi">
                            <Input
                              aria-label="Topshiriq nomi"
                              name="title"
                              required
                              defaultValue={editing?.title}
                            />
                          </Field>
                          <Field label="Ko‘rsatma">
                            <Textarea
                              aria-label="Topshiriq ko‘rsatmasi"
                              name="description"
                              required
                              defaultValue={editing?.description}
                            />
                          </Field>
                          <Field label="Topshirish muddati (Toshkent vaqti)">
                            <Input
                              aria-label="Topshirish muddati"
                              name="deadline"
                              type="datetime-local"
                              required
                              defaultValue={
                                editing
                                  ? campusDate(editing.deadline)
                                  : undefined
                              }
                            />
                          </Field>
                          <Field label="Urinishlar soni">
                            <Input
                              aria-label="Urinishlar soni"
                              name="max_attempts"
                              type="number"
                              min={1}
                              max={10}
                              defaultValue={editing?.max_attempts || 3}
                              required
                            />
                          </Field>
                          <label className="flex gap-2 items-center text-sm">
                            <input
                              name="allow_late"
                              type="checkbox"
                              defaultChecked={editing?.allow_late}
                            />
                            Muddatdan keyin ham qabul qilish
                          </label>
                          {!editing && (
                            <Field label="Topshiriq fayli (ixtiyoriy)">
                              <Input
                                aria-label="Topshiriq fayli"
                                name="file"
                                type="file"
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip"
                              />
                            </Field>
                          )}
                          <div className="flex gap-2">
                            <Button disabled={busy || !canCreate}>
                              {editing ? "Saqlash" : "Topshiriq yaratish"}
                            </Button>
                            {editing && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditing(null)}
                              >
                                Bekor qilish
                              </Button>
                            )}
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Dars topshiriqlari</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {mine(assignments).map((a) => (
                          <div className="manage-row wrap" key={a.id}>
                            <div>
                              <strong>{a.title}</strong>
                              <small>
                                {new Date(a.deadline).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })} ·{" "}
                                {a.submission_count} javob
                              </small>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(a)}
                              >
                                Tahrirlash
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${a.title}ni o‘chirish`}
                                disabled={busy || a.submission_count > 0}
                                onClick={() =>
                                  remove(`${a.title} o‘chirilsinmi?`, () =>
                                    api.removeAssignment(a.id),
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {!mine(assignments).length && (
                          <p>Hozircha topshiriqlar yo‘q.</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-4">
                          Javoblari mavjud topshiriqlar saqlanadi va
                          o‘chirilmaydi.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                <TabsContent value="grading">
                  <Card>
                    <CardHeader>
                      <CardTitle>Talabalar javoblari</CardTitle>
                      <label className="flex gap-2 items-center text-sm">
                        <input
                          type="checkbox"
                          checked={pendingOnly}
                          onChange={(e) => setPendingOnly(e.target.checked)}
                        />
                        Faqat baholanmaganlar
                      </label>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {submissions
                        .filter(
                          (s) =>
                            Number(s.assignment.course) === selected &&
                            (!pendingOnly || s.grade === null),
                        )
                        .map((s) => (
                          <form
                            className="grading-card"
                            key={`${s.id}-${s.grade}`}
                            onSubmit={submitForm((d) =>
                              api.gradeSubmission(
                                s.id,
                                Number(d.get("grade")),
                                String(d.get("feedback") || ""),
                              ),
                            )}
                          >
                            <div className="manage-row">
                              <div>
                                <strong>
                                  {s.student_name} · {s.assignment.title}
                                </strong>
                                <small>
                                  {s.attempt}-urinish ·{" "}
                                  {new Date(s.submitted_at).toLocaleString("uz-UZ", {
                                    timeZone: "Asia/Tashkent",
                                  })}
                                  {s.is_late ? " · Kech topshirilgan" : ""}
                                </small>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  api
                                    .downloadFile(s.file)
                                    .catch((e) => setError(e.message))
                                }
                              >
                                <Download size={16} />
                                Javob
                              </Button>
                            </div>
                            <div className="grading-inputs">
                              <Field label="Baho (0–100)">
                                <Input
                                  aria-label={`${s.student_name} bahosi`}
                                  name="grade"
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  required
                                  defaultValue={s.grade ?? ""}
                                />
                              </Field>
                              <Field label="Talabaga izoh">
                                <Textarea
                                  aria-label={`${s.student_name} uchun izoh`}
                                  name="feedback"
                                  defaultValue={s.feedback || ""}
                                />
                              </Field>
                              <Button disabled={busy}>Bahoni saqlash</Button>
                            </div>
                          </form>
                        ))}
                      {!submissions.some(
                        (s) =>
                          Number(s.assignment.course) === selected &&
                          (!pendingOnly || s.grade === null),
                      ) && <p>Bu tanlov bo‘yicha javoblar yo‘q.</p>}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="attendance">
                  <div className="management-grid">
                    <Card>
                      <CardHeader>
                        <CardTitle>Davomat mashg‘uloti</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form
                          className="space-y-4"
                          onSubmit={submitForm(async (d) => {
                            const position = await freshLocation();
                            return api.createAttendanceSession({
                              course: selected,
                              topic: d.get("topic"),
                              starts_at: d.get("starts_at")
                                ? campusStamp(d.get("starts_at"))
                                : new Date().toISOString(),
                              automated_checkin: true,
                              attendance_minutes: Number(d.get("attendance_minutes")),
                              location_latitude: position.coords.latitude,
                              location_longitude: position.coords.longitude,
                              location_radius_m: 80,
                              max_location_accuracy_m: 100,
                            });
                          })}
                        >
                          <Field label="Mashg‘ulot mavzusi">
                            <Input
                              aria-label="Mashg‘ulot mavzusi"
                              name="topic"
                              required
                            />
                          </Field>
                          <Field label="Boshlanish (Toshkent vaqti)">
                            <Input
                              aria-label="Mashg‘ulot boshlanishi"
                              name="starts_at"
                              type="datetime-local"
                            />
                            <span className="text-xs text-muted-foreground">Bo‘sh qoldirsangiz, tugma bosilgan vaqtda boshlanadi.</span>
                          </Field>
                          <Field label="Davomat oynasi (daqiqa)">
                            <Input aria-label="Davomat oynasi" name="attendance_minutes" type="number" min={2} max={15} defaultValue={10} required />
                          </Field>
                          <p className="text-sm text-muted-foreground">
                            Boshlashda auditoriya lokatsiyasi olinadi. Davomat oynasini 2–15 daqiqa oralig‘ida tanlang.
                          </p>
                          <Button disabled={busy || !canCreate}>
                            Davomatni boshlash
                          </Button>
                        </form>
                        <div className="mt-6">
                          <Label htmlFor="session-picker">
                            Davomatni belgilash uchun tanlang
                          </Label>
                          <select
                            id="session-picker"
                            className="native-select mt-2"
                            value={activeSession}
                            onChange={(e) =>
                              setActiveSession(Number(e.target.value))
                            }
                          >
                            <option value="0">Mashg‘ulotni tanlang</option>
                            {mine(sessions).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.topic} ·{" "}
                                {new Date(s.starts_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}
                              </option>
                            ))}
                          </select>
                        </div>
                        {activeSession > 0 && (
                          <AttendanceBroadcastPanel
                            sessionId={activeSession}
                            onChanged={async () => {
                              await load();
                              const data = await api.getAttendanceRecords(activeSession);
                              setMarks(
                                Object.fromEntries(
                                  data.map((r: Row) => [r.student, r.status]),
                                ),
                              );
                            }}
                          />
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Talabalar davomati</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {activeSession ? (
                          <>
                            <p className="text-sm text-muted-foreground mb-4">
                              Tanlangan holatlar saqlanadi. Belgilanmagan holat
                              avvalgi belgini tozalaydi; talaba avtomatik yo‘q
                              deb hisoblanmaydi.
                            </p>
                            {students.map((s) => (
                              <div className="manage-row wrap" key={s.id}>
                                <strong>{s.fullname}</strong>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    ["present", "Keldi"],
                                    ["late", "Kech qoldi"],
                                    ["absent", "Kelmadi"],
                                    ["excused", "Sababli"],
                                  ].map(([status, label]) => (
                                    <Button
                                      key={status}
                                      type="button"
                                      size="sm"
                                      variant={
                                        marks[s.id] === status
                                          ? status === "absent"
                                            ? "destructive"
                                            : "default"
                                          : "outline"
                                      }
                                      onClick={() =>
                                        setMarks((m) => ({
                                          ...m,
                                          [s.id]: status,
                                        }))
                                      }
                                    >
                                      {label}
                                    </Button>
                                  ))}
                                  {marks[s.id] && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setMarks((m) => ({ ...m, [s.id]: "" }))
                                      }
                                    >
                                      Tozalash
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                            <Button
                              className="mt-5"
                              disabled={busy || !students.length}
                              onClick={() =>
                                run(() =>
                                  api.saveAttendance(
                                    activeSession,
                                    Object.entries(marks)
                                      .filter(([, status]) => status)
                                      .map(([student, status]) => ({
                                        student: Number(student),
                                        status,
                                      })),
                                  ),
                                )
                              }
                            >
                              Davomatni saqlash
                            </Button>
                          </>
                        ) : (
                          <p>Chapdan mashg‘ulotni tanlang.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                <TabsContent value="calendar">
                  <div className="management-grid">
                    <Card>
                      <CardHeader>
                        <CardTitle>Yangi tadbir</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form
                          className="space-y-4"
                          onSubmit={submitForm((d) =>
                            api.createCalendarEvent({
                              course: selected,
                              title: d.get("title"),
                              description: d.get("description"),
                              event_type: d.get("event_type"),
                              period: calendarType === "lesson" ? Number(d.get("period")) : null,
                              room: d.get("room"),
                              for_group: d.get("for_group"),
                              start_time: campusStamp(d.get("start_time")),
                              end_time: campusStamp(d.get("end_time")),
                            }),
                          )}
                        >
                          <Field label="Tadbir nomi">
                            <Input
                              aria-label="Tadbir nomi"
                              name="title"
                              required
                            />
                          </Field>
                          <Field label="Turi">
                            <select
                              aria-label="Tadbir turi"
                              name="event_type"
                              className="native-select"
                              value={calendarType}
                              onChange={(event) => setCalendarType(event.target.value)}
                            >
                              <option value="lesson">Dars</option>
                              <option value="exam">Imtihon</option>
                              <option value="other">Boshqa</option>
                            </select>
                          </Field>
                          {calendarType === "lesson" && (
                            <Field label="Dars parasi">
                              <select
                                aria-label="Dars parasi"
                                name="period"
                                className="native-select"
                                defaultValue=""
                                required
                              >
                                <option value="" disabled>Parani tanlang</option>
                                {[1, 2, 3, 4, 5, 6].map((period) => (
                                  <option key={period} value={period}>{period}-para</option>
                                ))}
                              </select>
                            </Field>
                          )}
                          <Field label="Xona (ixtiyoriy)">
                            <Input aria-label="Tadbir xonasi" name="room" maxLength={50} />
                          </Field>
                          <Field label="Guruh (ixtiyoriy)">
                            <Input aria-label="Tadbir guruhi" name="for_group" maxLength={100} />
                          </Field>
                          <Field label="Boshlanish (Toshkent vaqti)">
                            <Input
                              aria-label="Tadbir boshlanishi"
                              name="start_time"
                              type="datetime-local"
                              required
                            />
                          </Field>
                          <Field label="Tugash (Toshkent vaqti)">
                            <Input
                              aria-label="Tadbir tugashi"
                              name="end_time"
                              type="datetime-local"
                              required
                            />
                          </Field>
                          <Field label="Izoh">
                            <Textarea
                              aria-label="Tadbir izohi"
                              name="description"
                            />
                          </Field>
                          <Button disabled={busy || !canCreate}>
                            Tadbir yaratish
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Dars taqvimi</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {mine(events).map((e) => (
                          <div className="manage-row" key={e.id}>
                            <div>
                              <strong>{e.title}</strong>
                              <small>
                                {new Date(e.start_time).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}
                              </small>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${e.title}ni o‘chirish`}
                              disabled={busy}
                              onClick={() =>
                                remove(`${e.title} o‘chirilsinmi?`, () =>
                                  api.removeEvent(e.id),
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        ))}
                        {!mine(events).length && (
                          <p>Tadbirlar rejalashtirilmagan.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
          <AlertDialog
            open={!!confirm}
            onOpenChange={(open) => !open && setConfirm(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  Ushbu o‘zgarish dars ma’lumotlariga ta’sir qiladi. Davom
                  etishni tasdiqlang.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (confirm) run(confirm.action, "Amal bajarildi.");
                    setConfirm(null);
                  }}
                >
                  Tasdiqlash
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      )}
    </ProtectedRoute>
  );
}
