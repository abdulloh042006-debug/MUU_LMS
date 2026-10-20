"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ClipboardList,
  Clock,
  FileText,
  UserCheck,
} from "lucide-react";
import {
  getAssignments,
  getBooks,
  getCalendar,
  getMyGrades,
  getMyAttendance,
} from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Tashkent",
  });

const timeLabel = (date: string) =>
  new Date(date).toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });

const demoBooks = [
  {
    id: 1,
    title: "Dasturlash asoslari",
    subject: "Axborot texnologiyalari",
    uploaded_at: "2026-10-01",
  },
  {
    id: 2,
    title: "Biznes muloqot",
    subject: "Umumiy fanlar",
    uploaded_at: "2026-10-02",
  },
  {
    id: 3,
    title: "Ingliz tili",
    subject: "Xorijiy tillar",
    uploaded_at: "2026-10-02",
  },
];

const demoAssignments = [
  {
    id: 1,
    title: "Python: shart operatorlari",
    description: "Masalalarni yeching va javob faylini topshiring.",
    due_date: "2026-10-05T18:00:00+05:00",
    is_submitted: false,
  },
  {
    id: 2,
    title: "Rasmiy xat yozish",
    description: "Biznes muloqot qoidalariga mos rasmiy xat tayyorlang.",
    due_date: "2026-10-07T18:00:00+05:00",
    is_submitted: false,
  },
  {
    id: 3,
    title: "Reading & vocabulary",
    description: "O‘quv matni asosida lug‘at topshiriqlarini bajaring.",
    due_date: "2026-10-08T18:00:00+05:00",
    is_submitted: true,
  },
];

const demoEvents = [
  {
    id: 1,
    title: "Dasturlash asoslari",
    start_date: "2026-10-05T09:00:00+05:00",
    end_date: "2026-10-05T10:10:00+05:00",
    description: "Amaliy mashg‘ulot",
  },
  {
    id: 2,
    title: "Biznes muloqot",
    start_date: "2026-10-05T10:20:00+05:00",
    end_date: "2026-10-05T11:30:00+05:00",
    description: "Seminar",
  },
];

const actionable = (item: any) =>
  !item.is_submitted && !item.course_archived &&
  (!item.is_overdue || item.allow_late) &&
  (item.attempts_used ?? 0) < (item.max_attempts ?? Infinity);

export function LMSDashboard({ demo = false }: { demo?: boolean }) {
  const { user } = useAuth();
  const [books, setBooks] = useState<any[]>(demo ? demoBooks : []);
  const [assignments, setAssignments] = useState<any[]>(
    demo ? demoAssignments : [],
  );
  const [grades, setGrades] = useState<any[]>(
    demo
      ? [
          { id: 1, grade: 92, assignment: { title: "Dasturlash asoslari" } },
          { id: 2, grade: 88, assignment: { title: "Biznes muloqot" } },
        ]
      : [],
  );
  const [events, setEvents] = useState<any[]>(demo ? demoEvents : []);
  const [attendance, setAttendance] = useState<any[]>(
    demo
      ? [
          ...Array.from({ length: 17 }, (_, index) => ({
            id: index + 1,
            status: "present",
          })),
          ...Array.from({ length: 4 }, (_, index) => ({
            id: index + 18,
            status: "absent",
          })),
        ]
      : [],
  );
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    if (demo) return;
    let active = true;
    Promise.all([
      getBooks(),
      getAssignments(),
      getMyGrades(),
      getCalendar(),
      getMyAttendance(),
    ])
      .then(([bookRows, assignmentRows, gradeRows, eventRows, attendanceRows]) => {
        if (!active) return;
        setBooks(bookRows);
        setAssignments(assignmentRows);
        setGrades(gradeRows);
        setEvents(eventRows);
        setAttendance(attendanceRows);
      })
      .catch(() => {
        if (active) {
          setError("Ma’lumotlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.");
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [demo]);

  const pending = useMemo(
    () =>
      assignments
        .filter(actionable)
        .sort(
          (a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
        ),
    [assignments],
  );
  const sortedAssignments = useMemo(
    () => [...assignments].sort(
      (a, b) => Number(actionable(b)) - Number(actionable(a)) ||
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    ),
    [assignments],
  );

  const validGrades = grades.filter(
    (grade) => grade.grade !== null && grade.grade !== undefined,
  );
  const average = validGrades.length
    ? Math.round(
        validGrades.reduce((sum, grade) => sum + Number(grade.grade), 0) /
          validGrades.length,
      )
    : null;

  const now = Date.now();
  const sevenDaysLater = now + 7 * 24 * 60 * 60 * 1000;
  const upcoming = events
    .filter((event) => {
      if (event.event_type && event.event_type !== "lesson") return false;
      if (demo) return true;
      const startsAt = new Date(event.start_date).getTime();
      return startsAt >= now && startsAt <= sevenDaysLater;
    })
    .sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    );

  const nextLesson = upcoming[0];
  const nextAssignment = pending[0];
  const attendedCount = attendance.filter(
    (row) => row.status === "present" || row.status === "late",
  ).length;
  const attendanceRate = attendance.length
    ? Math.round((attendedCount / attendance.length) * 100)
    : null;

  const action = (item: any, href: string) =>
    demo ? (
      <button
        className="item-action"
        onClick={() => setDetail(item)}
        aria-label={`${item.title} — ko‘rish`}
      >
        <ArrowUpRight size={19} />
      </button>
    ) : (
      <Link
        className="item-action"
        href={href}
        aria-label={`${item.title} — ko‘rish`}
      >
        <ArrowUpRight size={19} />
      </Link>
    );

  return (
    <main className="dashboard" id="overview">
      <div className="page-heading compact-heading">
        <div>
          <h1>
            {user?.first_name ? `Salom, ${user.first_name}` : "Bosh sahifa"}
          </h1>
          <p>Keyingi dars va bajarilishi kerak bo‘lgan ishlar.</p>
        </div>
        <div className="date-chip">
          <CalendarDays size={16} />
          {demo
            ? "3-oktabr, 2026"
            : new Date().toLocaleDateString("uz-UZ", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Asia/Tashkent",
              })}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="student-focus-grid" aria-label="Bugungi muhim ishlar">
        <article className="student-focus-card">
          <div className="student-focus-icon">
            <CalendarDays size={21} />
          </div>
          <div className="student-focus-body">
            <span className="student-focus-label">Keyingi dars</span>
            {nextLesson ? (
              <>
                <strong>{nextLesson.title}</strong>
                <p>
                  {dateLabel(nextLesson.start_date)} ·{" "}
                  {timeLabel(nextLesson.start_date)}–{timeLabel(nextLesson.end_date)}
                </p>
              </>
            ) : (
              <>
                <strong>Yaqin dars yo‘q</strong>
                <p>Jadval yangilanganda shu yerda ko‘rinadi.</p>
              </>
            )}
          </div>
          <Link href={demo ? "#materials" : "/my-courses"} aria-label="Darslarni ochish">
            <ArrowRight size={18} />
          </Link>
        </article>

        <article className="student-focus-card">
          <div className="student-focus-icon">
            <ClipboardList size={21} />
          </div>
          <div className="student-focus-body">
            <span className="student-focus-label">Eng yaqin topshiriq</span>
            {nextAssignment ? (
              <>
                <strong>{nextAssignment.title}</strong>
                <p>
                  {nextAssignment.is_overdue && nextAssignment.allow_late
                    ? "Muddat o‘tgan · Kech topshirish mumkin"
                    : <>{dateLabel(nextAssignment.due_date)} · {timeLabel(nextAssignment.due_date)} gacha</>}
                </p>
              </>
            ) : (
              <>
                <strong>Faol topshiriq yo‘q</strong>
                <p>Yangi vazifa berilganda shu yerda chiqadi.</p>
              </>
            )}
          </div>
          <Link href={demo ? "#assignments" : nextAssignment ? `/assignments/${nextAssignment.id}` : "/assignments"} aria-label="Topshiriqlarni ochish">
            <ArrowRight size={18} />
          </Link>
        </article>
      </section>

      <section className="stats-grid" aria-label="O‘qish ko‘rsatkichlari">
        <Link
          className="stat-card stat-card-link"
          href={demo ? "#assignments" : "/assignments"}
        >
          <div className="stat-icon gold">
            <ClipboardList size={21} />
          </div>
          <div>
            <p>Faol topshiriqlar</p>
            <div className="stat-value">
              {loading ? "…" : pending.length}
              <span>ta</span>
            </div>
          </div>
        </Link>
        <Link
          className="stat-card stat-card-link"
          href={demo ? "#materials" : "/my-courses"}
        >
          <div className="stat-icon purple">
            <CalendarDays size={21} />
          </div>
          <div>
            <p>7 kunlik darslar</p>
            <div className="stat-value">
              {loading ? "…" : upcoming.length}
              <span>ta</span>
            </div>
          </div>
        </Link>
        <Link
          className="stat-card stat-card-link"
          href={demo ? "#results" : "/grades"}
        >
          <div className="stat-icon green">
            <ChartNoAxesCombined size={21} />
          </div>
          <div>
            <p>O‘rtacha natija</p>
            <div className="stat-value">
              {loading ? "…" : average === null ? "—" : average}
              <span>{average === null ? "hali yo‘q" : "/100"}</span>
            </div>
          </div>
        </Link>
        <Link
          className="stat-card stat-card-link"
          href={demo ? "#overview" : "/attendance"}
        >
          <div className="stat-icon navy">
            <UserCheck size={21} />
          </div>
          <div>
            <p>Davomat</p>
            <div className="stat-value">
              {loading ? "…" : attendanceRate === null ? "—" : attendanceRate}
              <span>{attendanceRate === null ? "hali yo‘q" : "%"}</span>
            </div>
          </div>
        </Link>
      </section>

      <div className="dashboard-main-grid">
        <section className="panel assignment-panel" id="assignments">
          <div className="section-heading">
            <div>
              <h2>Topshiriqlar</h2>
              <p>Yaqin muddatli vazifalar birinchi ko‘rsatiladi.</p>
            </div>
            <Link href={demo ? "#assignments" : "/assignments"}>
              Barchasi <ArrowRight size={15} />
            </Link>
          </div>
          <div className="assignment-head">
            <span>TOPSHIRIQ</span>
            <span>MUDDAT</span>
            <span>HOLAT</span>
          </div>
          {sortedAssignments.slice(0, 4).map((assignment) => (
            <div className="assignment-row" key={assignment.id}>
              <div className="assignment-title">
                <div className="assignment-icon">
                  <ClipboardList size={17} />
                </div>
                <div>
                  <h3>{assignment.title}</h3>
                  <span>
                    {assignment.is_submitted
                      ? "Javob qabul qilingan"
                      : actionable(assignment)
                        ? "Topshirish kerak"
                        : "Topshirish yopilgan"}
                  </span>
                </div>
              </div>
              <div className="deadline">
                <Clock size={13} />
                {dateLabel(assignment.due_date)}
              </div>
              <span
                className={`status-badge ${assignment.is_submitted ? "done" : "pending"}`}
              >
                {assignment.is_submitted ? <Check size={12} /> : null}
                {assignment.is_submitted
                  ? "Topshirildi"
                  : actionable(assignment)
                    ? "Kutilmoqda"
                    : "Yopilgan"}
              </span>
              {action(assignment, `/assignments/${assignment.id}`)}
            </div>
          ))}
          {!loading && !assignments.length && (
            <div className="empty-message">
              <ClipboardList />
              Hozircha topshiriq yo‘q.
            </div>
          )}
        </section>

        <section className="panel" id="materials">
          <div className="section-heading">
            <div>
              <h2>Dars materiallari</h2>
              <p>Oxirgi yuklangan fayllar.</p>
            </div>
            <Link href={demo ? "#materials" : "/courses"}>
              Barchasi <ArrowRight size={15} />
            </Link>
          </div>
          <div className="material-grid">
            {books.slice(0, 3).map((book, index) => (
              <article className="material-card" key={book.id}>
                <div className={`material-cover cover-${index % 3}`}>
                  <BookOpen size={30} strokeWidth={1.4} />
                </div>
                <div className="material-content">
                  <span className="subject-tag">
                    {book.subject || "Dars materiali"}
                  </span>
                  <h3>{book.title}</h3>
                  <div className="material-bottom">
                    <span>
                      <FileText size={13} />
                      Material
                    </span>
                    {action(book, `/courses/${book.id}`)}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!loading && !books.length && (
            <div className="empty-message">
              <BookOpen />
              Hozircha material yuklanmagan.
            </div>
          )}
        </section>

        <section className="panel results-panel">
          <div className="section-heading">
            <div>
              <h2>So‘nggi baholar</h2>
              <p>Tekshirilgan ishlarning natijalari.</p>
            </div>
            <ChartNoAxesCombined size={19} />
          </div>
          {validGrades.slice(0, 4).map((grade) => (
            <div className="grade-row" key={grade.id}>
              <span className="grade-icon">
                <Check size={15} />
              </span>
              <div>
                <h3>{grade.assignment?.title || "Topshiriq"}</h3>
                <p>Baholangan</p>
              </div>
              <strong>
                {grade.grade}
                <small>/100</small>
              </strong>
            </div>
          ))}
          {!loading && !validGrades.length && (
            <div className="empty-message small">Hali baho qo‘yilmagan.</div>
          )}
          <Link
            className="schedule-link"
            href={demo ? "#results" : "/grades"}
          >
            Barcha baholar <ArrowRight size={15} />
          </Link>
        </section>
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>
              Bu dizayn namoyishidagi namunaviy ma’lumot.
            </DialogDescription>
          </DialogHeader>
          <p>
            {detail?.description ||
              "Haqiqiy kabinetda tegishli ma’lumot shu bo‘limdan ochiladi."}
          </p>
          <Button asChild>
            <Link href="/login">
              Haqiqiy kabinetga kirish <ArrowRight size={16} />
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
