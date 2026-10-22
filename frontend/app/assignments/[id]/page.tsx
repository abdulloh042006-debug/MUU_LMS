"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, FileUp, Paperclip } from "lucide-react";
import { getAssignmentById, getSubmissions, submitAssignment, downloadFile } from "@/lib/api-service";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import { Empty, ErrorNote, Notice, Page, PageSkeleton, Panel, Pill, Progress } from "@/components/mu/kit";
import { fmtDateTime, timeLeft } from "@/lib/format";

export default function Assignment() {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [a, s] = await Promise.all([getAssignmentById(String(id)), getSubmissions(String(id))]);
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
    if (file.size > 10 * 1024 * 1024) return setError("Fayl 10 MB dan oshmasin.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await submitAssignment(String(id), file);
      await load();
      form.reset();
      setFile(null);
      setNotice("Javobingiz saqlandi. Ustoz baholagach natija shu yerda ko‘rinadi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const student = user?.role === "student";
  const blocked = item && (item.attempts_used >= item.max_attempts || item.course_archived || (item.is_overdue && !item.allow_late));
  const left = item ? timeLeft(item.deadline) : null;

  return (
    <ProtectedRoute>
      <Page>
        <Link href="/assignments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-700">
          <ArrowLeft size={16} /> Topshiriqlar
        </Link>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {loading ? (
          <PageSkeleton rows={1} />
        ) : (
          item && (
            <>
              <header className="mb-6 rounded-3xl bg-gradient-to-br from-navy-700 to-navy-900 p-6 text-white shadow-lift md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">{item.course_title}</p>
                <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{item.title}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-navy-100">
                  <span>Muddat: <b className="text-white">{fmtDateTime(item.deadline)}</b></span>
                  {left && <Pill tone={item.is_submitted ? "green" : left.past ? "red" : left.urgent ? "amber" : "gold"}>{item.is_submitted ? "Yuborilgan" : left.past ? "Muddati o‘tgan" : `${left.text} qoldi`}</Pill>}
                </div>
              </header>

              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <Panel title="Topshiriq ko‘rsatmasi" icon={Paperclip}>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.description}</p>
                  {item.file && (
                    <button onClick={() => downloadFile(item.file).catch((e) => setError(e.message))} className="mt-5 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50">
                      <Download size={16} /> Topshiriq fayli
                    </button>
                  )}
                </Panel>

                {student ? (
                  <Panel title="Javob yuborish" icon={FileUp}>
                    <div className="mb-4">
                      <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                        <span>Urinishlar</span>
                        <span>{item.attempts_used} / {item.max_attempts}</span>
                      </div>
                      <Progress value={(item.attempts_used / item.max_attempts) * 100} thin tone="gold" />
                      {item.allow_late && <p className="mt-2 text-xs text-muted-foreground">Kech topshirish mumkin</p>}
                    </div>
                    {blocked ? (
                      <Notice tone="amber">
                        {item.course_archived ? "Dars arxivlangan." : item.attempts_used >= item.max_attempts ? "Barcha urinishlar ishlatilgan." : "Topshirish muddati tugagan."}
                      </Notice>
                    ) : (
                      <form onSubmit={submit} className="space-y-4">
                        <label htmlFor="submission" className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 bg-navy-50/50 px-4 py-7 text-center transition hover:border-gold-400 hover:bg-gold-50">
                          <FileUp className="text-navy-500" />
                          <span className="text-sm font-semibold text-navy-800">{file ? file.name : "Faylni tanlang"}</span>
                          <span className="text-xs text-muted-foreground">PDF, Office, rasm yoki ZIP · 10 MB gacha</span>
                          <input id="submission" type="file" className="sr-only" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        </label>
                        <button disabled={busy || !file} className="h-11 w-full rounded-xl bg-navy-700 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-50">
                          {busy ? "Yuborilmoqda…" : "Javobni topshirish"}
                        </button>
                      </form>
                    )}
                    {notice && (
                      <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800" role="status">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {notice}
                      </div>
                    )}
                  </Panel>
                ) : (
                  <Panel title="Baholash">
                    <p className="text-sm text-muted-foreground">Talabalar javoblarini ustoz kabinetida baholang.</p>
                    <Link href={`/manage?tab=grading&course=${item.course}`} className="mt-4 inline-flex rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">
                      Baholashga o‘tish
                    </Link>
                  </Panel>
                )}
              </div>

              <Panel title={student ? "Javoblarim tarixi" : "Talabalar javoblari"} className="mt-6">
                {rows.length ? (
                  <ul className="divide-y">
                    {rows.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy-900">{!student && `${s.student_name} · `}{s.attempt}-urinish</p>
                          <p className="text-xs text-muted-foreground">{fmtDateTime(s.submitted_at)}{s.is_late ? " · Kech topshirilgan" : ""}</p>
                          {s.feedback && <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700"><b>Ustoz izohi:</b> {s.feedback}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {s.grade === null ? <Pill tone="amber">Baholanmagan</Pill> : <Pill tone="green">{s.grade} / 100</Pill>}
                          <button onClick={() => downloadFile(s.file).catch((e) => setError(e.message))} className="grid size-9 place-items-center rounded-lg border text-navy-600 hover:bg-navy-50" aria-label="Javob faylini yuklash">
                            <Download size={15} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="Hali javob yuborilmagan" />
                )}
              </Panel>
            </>
          )
        )}
      </Page>
    </ProtectedRoute>
  );
}
