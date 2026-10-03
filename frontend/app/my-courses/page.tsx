"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getCourses } from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, Users } from "lucide-react";
export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">TA’LIM YO‘NALISHLARINGIZ</p>
            <h1>Mening kurslarim</h1>
            <p>Sizga biriktirilgan fanlar va o‘quv guruhlari.</p>
          </div>
          {user?.role !== "student" && (
            <Button asChild>
              <Link href="/manage">Kurslarni boshqarish</Link>
            </Button>
          )}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <p>Yuklanmoqda…</p>
        ) : !courses.length ? (
          <div className="empty-message">
            <BookOpen />
            <p>
              Hozircha kursga biriktirilmagansiz. Ustozingizga{" "}
              <strong>@{user?.username}</strong> foydalanuvchi nomingizni
              bering.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {courses.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <span className="subject-tag">
                    {c.code}
                    {c.is_archived ? " · ARXIV" : ""}
                  </span>
                  <CardTitle>{c.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {c.description || "Kurs tavsifi kiritilmagan."}
                  </p>
                  <p className="text-sm">
                    Ustoz: <strong>{c.teacher_name}</strong>
                  </p>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users size={16} />
                    {c.student_count} talaba
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/courses?course=${c.id}`}>Materiallar</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/assignments?course=${c.id}`}>
                        Topshiriqlar
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
