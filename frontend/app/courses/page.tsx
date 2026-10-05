"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Search } from "lucide-react";
import { getBooks } from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

function CoursesContent() {
  const course = useSearchParams().get("course");
  const [books, setBooks] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBooks()
      .then(setBooks)
      .catch(() =>
        setError("Materiallarni yuklab bo‘lmadi. Qayta urinib ko‘ring."),
      )
      .finally(() => setLoading(false));
  }, []);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books.filter((book) =>
      (!course || String(book.course) === course) &&
      (!normalized || `${book.title} ${book.subject}`.toLowerCase().includes(normalized)),
    );
  }, [books, course, query]);

  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">DARSLIK VA FAYLLAR</p>
            <h1>O‘quv materiallari</h1>
            <p>Darslaringiz bo‘yicha ustoz joylagan materiallarni toping va oching.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Materiallarni qidirish"
              placeholder="Materiallarni qidirish..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p>Yuklanmoqda…</p>
        ) : !filteredBooks.length ? (
          <div className="empty-message">
            <BookOpen />
            <p>
              {query
                ? "Qidiruv bo‘yicha material topilmadi."
                : "Hozircha materiallar yo‘q. O‘qituvchi yuklagach shu yerda ko‘rinadi."}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredBooks.map((book) => (
              <Card key={book.id}>
                <CardContent className="p-6">
                  <span className="subject-tag">{book.subject}</span>
                  <h2 className="text-xl font-semibold my-4">{book.title}</h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    {book.course_title || "O‘quv materiali"}
                  </p>
                  <Button asChild>
                    <Link href={`/courses/${book.id}`}>Materialni ochish</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

export default function CoursesPage() {
  return <Suspense fallback={<main className="workspace-page">Yuklanmoqda…</main>}><CoursesContent /></Suspense>;
}
