"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getCourses, getTeacherSubmissions } from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
export function TeacherHome() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([getCourses(), getTeacherSubmissions()])
      .then(([c, s]) => {
        setCourses(c);
        setRows(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <main className="workspace-page">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">USTOZ KABINETI</p>
          <h1>Assalomu alaykum, {user?.first_name}!</h1>
          <p>Kurslaringiz va tekshirishni kutayotgan javoblar.</p>
        </div>
        <Button asChild>
          <Link href="/manage">Boshqaruvni ochish</Link>
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading ? (
        <p>Yuklanmoqda…</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              ["Faol kurslar", courses.filter((c) => !c.is_archived).length],
              ["Jami javoblar", rows.length],
              [
                "Baholash kutilmoqda",
                rows.filter((r) => r.grade === null).length,
              ],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <strong className="text-3xl">{value}</strong>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="management-grid">
            <Card>
              <CardHeader>
                <CardTitle>Kurslarim</CardTitle>
              </CardHeader>
              <CardContent>
                {courses.map((c) => (
                  <div className="manage-row" key={c.id}>
                    <div>
                      <strong>{c.title}</strong>
                      <small>
                        {c.code} · {c.student_count} talaba
                        {c.is_archived ? " · Arxiv" : ""}
                      </small>
                    </div>
                  </div>
                ))}
                {!courses.length && (
                  <p>Boshqaruv bo‘limida birinchi kursingizni yarating.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Yangi javoblar</CardTitle>
              </CardHeader>
              <CardContent>
                {rows
                  .filter((r) => r.grade === null)
                  .slice(0, 8)
                  .map((r) => (
                    <div className="manage-row" key={r.id}>
                      <div>
                        <strong>{r.student_name}</strong>
                        <small>
                          {r.assignment.title} · {r.attempt}-urinish
                        </small>
                      </div>
                    </div>
                  ))}
                {!rows.some((r) => r.grade === null) && (
                  <p>Barcha yuborilgan javoblar baholangan.</p>
                )}
                <Button asChild className="mt-5" variant="outline">
                  <Link href="/manage">Baholash bo‘limiga o‘tish</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
