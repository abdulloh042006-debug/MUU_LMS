"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Users,
} from "lucide-react";
import {
  getCalendar,
  getCourses,
  getTeacherSubmissions,
} from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TeacherHome() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCourses(), getTeacherSubmissions(), getCalendar()])
      .then(([courseRows, submissionRows, eventRows]) => {
        setCourses(courseRows);
        setRows(submissionRows);
        setEvents(eventRows);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const pending = useMemo(
    () => rows.filter((row) => row.grade === null),
    [rows],
  );

  const todayLessons = useMemo(() => {
    const today = new Date();
    return events
      .filter((event) => {
        if (event.event_type && event.event_type !== "lesson") return false;
        const date = new Date(event.start_date);
        return (
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate()
        );
      })
      .sort(
        (a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );
  }, [events]);

  return (
    <main className="workspace-page teacher-dashboard">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">USTOZ KABINETI</p>
          <h1>
            {user?.first_name
              ? `Assalomu alaykum, ${user.first_name}`
              : "Ustoz kabineti"}
          </h1>
          <p>Bugungi darslar va tekshirishni kutayotgan ishlar.</p>
        </div>
        <Button asChild>
          <Link href="/manage">Boshqaruvni ochish</Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="notification-state">Yuklanmoqda…</div>
      ) : (
        <>
          <section className="teacher-action-grid">
            <Link href="/my-courses" className="teacher-action-card">
              <div className="teacher-action-icon">
                <CalendarDays size={21} />
              </div>
              <div>
                <span>Bugungi darslar</span>
                <strong>{todayLessons.length} ta</strong>
                <small>Dars jadvali va davomatni ochish</small>
              </div>
              <ChevronRight size={18} />
            </Link>

            <Link href="/manage?tab=grading" className="teacher-action-card">
              <div className="teacher-action-icon">
                <ClipboardCheck size={21} />
              </div>
              <div>
                <span>Baholash kutilmoqda</span>
                <strong>{pending.length} ta</strong>
                <small>Talabalar yuborgan ishlarni tekshirish</small>
              </div>
              <ChevronRight size={18} />
            </Link>

            <Link href="/manage" className="teacher-action-card">
              <div className="teacher-action-icon">
                <GraduationCap size={21} />
              </div>
              <div>
                <span>Faol darslar</span>
                <strong>{courses.filter((c) => !c.is_archived).length} ta</strong>
                <small>Material, topshiriq va talabalar</small>
              </div>
              <ChevronRight size={18} />
            </Link>
          </section>

          <div className="management-grid">
            <Card>
              <CardHeader>
                <CardTitle>Bugungi jadval</CardTitle>
              </CardHeader>
              <CardContent>
                {todayLessons.map((lesson) => (
                  <Link
                    href="/my-courses"
                    className="teacher-today-row"
                    key={lesson.id}
                  >
                    <div className="teacher-time">
                      {new Date(lesson.start_date).toLocaleTimeString("uz-UZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Tashkent",
                      })}
                    </div>
                    <div>
                      <strong>{lesson.title}</strong>
                      <small>
                        {lesson.for_group || lesson.course_title || "Guruh"} ·{" "}
                        {lesson.room || "Xona belgilanmagan"}
                      </small>
                    </div>
                    <ChevronRight size={17} />
                  </Link>
                ))}
                {!todayLessons.length && (
                  <div className="empty-message small">
                    <CheckCircle2 />
                    Bugun rejalashtirilgan dars yo‘q.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tekshirish navbati</CardTitle>
              </CardHeader>
              <CardContent>
                {pending.slice(0, 8).map((row) => (
                  <Link href={`/manage?tab=grading&course=${row.assignment.course}`} className="teacher-pending-row" key={row.id}>
                    <div className="teacher-student-avatar">
                      {(row.student_name || "T").slice(0, 1)}
                    </div>
                    <div>
                      <strong>{row.student_name}</strong>
                      <small>
                        {row.assignment.title} · {row.attempt}-urinish
                      </small>
                    </div>
                    <ChevronRight size={17} />
                  </Link>
                ))}
                {!pending.length && (
                  <div className="empty-message small">
                    <CheckCircle2 />
                    Barcha yuborilgan ishlar baholangan.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle>Darslarim</CardTitle>
            </CardHeader>
            <CardContent className="teacher-course-list">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/manage?course=${course.id}`}
                  className="teacher-course-row"
                >
                  <div>
                    <strong>{course.title}</strong>
                    <small>
                      {course.code} · {course.student_count} talaba
                      {course.is_archived ? " · Arxiv" : ""}
                    </small>
                  </div>
                  <span>
                    <Users size={15} />
                    {course.student_count}
                  </span>
                  <ChevronRight size={17} />
                </Link>
              ))}
              {!courses.length && (
                <p>Boshqaruv bo‘limida birinchi darsingizni yarating.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
