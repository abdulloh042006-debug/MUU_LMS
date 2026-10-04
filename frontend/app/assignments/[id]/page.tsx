"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getAssignmentById,
  getSubmissions,
  submitAssignment,
  downloadFile,
} from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
export default function Assignment() {
  const { id } = useParams(),
    { user } = useAuth();
  const [item, setItem] = useState<any>(null),
    [rows, setRows] = useState<any[]>([]),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [a, s] = await Promise.all([
      getAssignmentById(String(id)),
      getSubmissions(String(id)),
    ]);
    setItem(a);
    setRows(s);
  }, [id]);
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const form = e.currentTarget;
    if (file.size > 10 * 1024 * 1024) {
      setError("Fayl 10 MB dan oshmasin.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await submitAssignment(String(id), file);
      await load();
      form.reset();
      setFile(null);
      setNotice(
        "Javobingiz saqlandi. Ustoz baholagach natija shu yerda ko‘rinadi.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const student = user?.role === "student";
  const blocked =
    item &&
    (item.attempts_used >= item.max_attempts ||
      item.course_archived ||
      (item.is_overdue && !item.allow_late));
  return (
    <ProtectedRoute>
      <main className="workspace-page">
        <Link href="/assignments" className="text-sm">
          ← Topshiriqlar
        </Link>
        {error && (
          <Alert variant="destructive" className="my-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <p>Yuklanmoqda…</p>
        ) : (
          item && (
            <>
              <div className="workspace-heading mt-6">
                <div>
                  <p className="eyebrow">{item.course_title}</p>
                  <h1>{item.title}</h1>
                  <p>
                    Topshirish muddati:{" "}
                    {new Date(item.deadline).toLocaleString("uz-UZ")}
                  </p>
                </div>
                <span
                  className={`status-badge ${item.is_submitted ? "done" : "pending"}`}
                >
                  {item.is_submitted
                    ? "Javob yuborilgan"
                    : item.is_overdue
                      ? "Muddati tugagan"
                      : "Kutilmoqda"}
                </span>
              </div>
              <div className="management-grid">
                <Card>
                  <CardHeader>
                    <CardTitle>Topshiriq ko‘rsatmasi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap leading-7">
                      {item.description}
                    </p>
                    {item.file && (
                      <Button
                        className="mt-5"
                        variant="outline"
                        onClick={() =>
                          downloadFile(item.file).catch((e) =>
                            setError(e.message),
                          )
                        }
                      >
                        Topshiriq faylini yuklash
                      </Button>
                    )}
                  </CardContent>
                </Card>
                {student ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Javob yuborish</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ishlatilgan urinish: {item.attempts_used} /{" "}
                        {item.max_attempts}
                        {item.allow_late ? " · Kech topshirish mumkin" : ""}
                      </p>
                      {blocked ? (
                        <p role="status">
                          {item.course_archived
                            ? "Kurs arxivlangan."
                            : item.attempts_used >= item.max_attempts
                              ? "Barcha urinishlar ishlatilgan."
                              : "Topshirish muddati tugagan."}
                        </p>
                      ) : (
                        <form onSubmit={submit} className="space-y-4">
                          <Label htmlFor="submission">
                            Javob fayli (PDF, Office, matn, rasm yoki ZIP; 10 MB
                            gacha)
                          </Label>
                          <Input
                            id="submission"
                            type="file"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip"
                            required
                            onChange={(e) =>
                              setFile(e.target.files?.[0] || null)
                            }
                          />
                          <Button disabled={busy || !file}>
                            {busy ? "Yuborilmoqda…" : "Javobni topshirish"}
                          </Button>
                        </form>
                      )}
                      {notice && (
                        <p role="status" className="success-note">
                          {notice}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-6">
                      <p>Javoblarni ustoz kabinetida baholang.</p>
                      <Button asChild className="mt-4">
                        <Link href="/manage">Baholashga o‘tish</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>
                    {student ? "Javoblarim tarixi" : "Talabalar javoblari"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rows.map((s) => (
                    <div className="manage-row wrap" key={s.id}>
                      <div>
                        <strong>
                          {!student && `${s.student_name} · `}
                          {s.attempt}-urinish
                        </strong>
                        <small>
                          {new Date(s.submitted_at).toLocaleString("uz-UZ")}
                          {s.is_late ? " · Kech topshirilgan" : ""}
                        </small>
                        <p className="text-sm mt-2">
                          {s.grade === null
                            ? "Baholash kutilmoqda"
                            : `Baho: ${s.grade} / 100`}
                        </p>
                        {s.feedback && (
                          <p className="text-sm mt-2">
                            <strong>Ustoz izohi:</strong> {s.feedback}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadFile(s.file).catch((e) => setError(e.message))
                        }
                      >
                        Javob fayli
                      </Button>
                    </div>
                  ))}
                  {!rows.length && <p>Hali javob yuborilmagan.</p>}
                </CardContent>
              </Card>
            </>
          )
        )}
      </main>
    </ProtectedRoute>
  );
}
