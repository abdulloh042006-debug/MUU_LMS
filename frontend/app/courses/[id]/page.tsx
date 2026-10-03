"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBookById, downloadFile } from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export default function Material() {
  const { id } = useParams();
  const [book, setBook] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    getBookById(String(id))
      .then(setBook)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <ProtectedRoute>
      <main className="container mx-auto p-8">
        <Link href="/courses">← Materiallar</Link>
        {error ? (
          <p role="alert">{error}</p>
        ) : book ? (
          <Card className="mt-6">
            <CardContent className="p-8">
              <p className="text-teal-700">{book.subject}</p>
              <h1 className="text-3xl font-bold my-5">{book.title}</h1>
              <Button
                onClick={() =>
                  downloadFile(book.file).catch((e) => setError(e.message))
                }
              >
                Materialni yuklash
              </Button>
            </CardContent>
          </Card>
        ) : (
          <p>Yuklanmoqda…</p>
        )}
      </main>
    </ProtectedRoute>
  );
}
