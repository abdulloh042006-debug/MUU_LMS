"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { getBookById, downloadFile } from "@/lib/api-service";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Material() {
  const { id } = useParams();
  const [book, setBook] = useState<any>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getBookById(String(id))
      .then(setBook)
      .catch((e) => setError(e.message));
  }, [id]);

  async function download() {
    if (!book?.file || downloading) return;
    setDownloading(true);
    setError("");
    try {
      await downloadFile(book.file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <Link href="/courses" className="text-sm">
          ← Materiallar
        </Link>

        {error && (
          <Alert variant="destructive" className="my-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!book && !error ? (
          <p className="mt-6">Yuklanmoqda…</p>
        ) : (
          book && (
            <Card className="mt-6">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <FileText size={20} />
                  <span>{book.course_title || "O‘quv materiali"}</span>
                </div>
                <p className="eyebrow mt-6">{book.subject}</p>
                <h1 className="text-3xl font-semibold my-4">{book.title}</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  Fayl autentifikatsiya orqali himoyalangan. Yuklash tugmasi
                  faqat ushbu kursga kirish huquqingiz bo‘lsa ishlaydi.
                </p>
                <Button onClick={download} disabled={downloading}>
                  <Download size={17} />
                  {downloading ? "Yuklanmoqda…" : "Materialni yuklash"}
                </Button>
              </CardContent>
            </Card>
          )
        )}
      </main>
    </ProtectedRoute>
  );
}
