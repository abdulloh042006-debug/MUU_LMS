"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBooks } from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function CoursesPage() {
  const [books, setBooks] = useState<any[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    getBooks()
      .then((data) => {
        const course = new URLSearchParams(window.location.search).get(
          "course",
        );
        setBooks(
          course ? data.filter((b: any) => String(b.course) === course) : data,
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-8">
        <Link href="/dashboard" className="text-teal-700">
          ← Bosh sahifa
        </Link>
        <h1 className="text-3xl font-bold my-6">O‘quv materiallari</h1>
        <Input
          aria-label="Materiallarni qidirish"
          placeholder="Materiallarni qidirish..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md mb-6"
        />
        {error && <p role="alert">{error}</p>}
        {loading ? (
          <p>Yuklanmoqda…</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {books
              .filter((b) =>
                (b.title + " " + b.subject)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-6">
                    <p className="text-teal-700">{b.subject}</p>
                    <h2 className="text-xl font-semibold my-4">{b.title}</h2>
                    <Button asChild>
                      <Link href={`/courses/${b.id}`}>Materialni ochish</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
        {!loading && !error && !books.length && (
          <p>
            Hozircha materiallar yo‘q. O‘qituvchi ularni yuklagach ko‘rinadi.
          </p>
        )}
      </main>
    </ProtectedRoute>
  );
}
