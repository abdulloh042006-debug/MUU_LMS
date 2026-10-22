"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, ListChecks, Play, RotateCcw, Timer, XCircle } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { getQuiz, getQuizResults, submitQuiz } from "@/lib/api-service";
import { Avatar, Empty, ErrorNote, Notice, Page, PageSkeleton, Panel, Pill, Progress, Ring, Stat, useLoad } from "@/components/mu/kit";
import { fmtDateTime, gradeTone, timeLeft } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function QuizPage() {
  return (
    <ProtectedRoute>
      <Inner />
    </ProtectedRoute>
  );
}

function Inner() {
  const { id } = useParams();
  const { user } = useAuth();
  const teacher = user?.role === "ustoz" || user?.role === "admin";
  const { data: quiz, loading, error, reload } = useLoad(() => getQuiz(String(id)), [id]);
  if (loading && !quiz) return <Page><PageSkeleton /></Page>;
  if (!quiz || (error && !quiz)) return <Page><ErrorNote message={error || "Test topilmadi."} /></Page>;
  return teacher ? <TeacherView quiz={quiz} /> : <StudentView quiz={quiz} reload={reload} />;
}

function Back() {
  return (
    <Link href="/quizzes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-700">
      <ArrowLeft size={16} /> Testlar
    </Link>
  );
}

function StudentView({ quiz, reload }: { quiz: any; reload: () => void }) {
  const [phase, setPhase] = useState<"intro" | "run" | "result">("intro");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<any | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const left = quiz.max_attempts - quiz.attempts_used;
  const blocked = left <= 0 || quiz.is_overdue;
  const total = quiz.questions.length;

  const finish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await submitQuiz(quiz.id, answers);
      setResult(r);
      setPhase("result");
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [answers, busy, quiz.id, reload]);

  useEffect(() => {
    if (phase !== "run") return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [phase]);

  const remaining = Math.max(0, endsAt - now);
  useEffect(() => {
    if (phase === "run" && remaining === 0) void finish();
  }, [phase, remaining, finish]);

  function start() {
    setAnswers(Array(total).fill(null));
    setIndex(0);
    setResult(null);
    setEndsAt(Date.now() + quiz.time_limit_min * 60_000);
    setNow(Date.now());
    setPhase("run");
  }

  const answered = answers.filter((a) => a !== null).length;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  if (phase === "run") {
    const q = quiz.questions[index];
    return (
      <Page className="max-w-3xl">
        <div className="sticky top-16 z-10 -mx-4 mb-5 border-b bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:bg-white md:shadow-card">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-navy-900">{quiz.title}</p>
            <span className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-sm font-bold", remaining < 60_000 ? "bg-rose-50 text-rose-700" : "bg-navy-50 text-navy-800")}>
              <Timer size={15} /> {mm}:{ss}
            </span>
          </div>
          <Progress value={((index + 1) / total) * 100} thin tone="gold" className="mt-3" />
        </div>
        {err && <div className="mb-4"><ErrorNote message={err} /></div>}
        <section className="rounded-3xl border bg-white p-5 shadow-card md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">{index + 1}-savol / {total}</p>
          <h2 className="mt-2 text-lg font-semibold leading-snug text-navy-900 md:text-xl">{q.text}</h2>
          <div className="mt-6 space-y-2.5" role="radiogroup">
            {q.options.map((o: string, k: number) => {
              const active = answers[index] === k;
              return (
                <button
                  key={k}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAnswers(answers.map((a, i) => (i === index ? k : a)))}
                  className={cn("flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left text-sm transition", active ? "border-navy-700 bg-navy-50" : "border-transparent bg-slate-50 hover:border-navy-200")}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold", active ? "bg-navy-700 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200")}>{String.fromCharCode(65 + k)}</span>
                  <span className="font-medium text-navy-900">{o}</span>
                </button>
              );
            })}
          </div>
        </section>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {quiz.questions.map((_: any, i: number) => (
              <button key={i} onClick={() => setIndex(i)} aria-label={`${i + 1}-savol`} className={cn("grid size-9 place-items-center rounded-lg text-xs font-bold transition", i === index ? "bg-navy-700 text-white" : answers[i] !== null ? "bg-gold-100 text-gold-800" : "bg-white text-slate-500 ring-1 ring-slate-200")}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button disabled={index === 0} onClick={() => setIndex(index - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-xl border bg-white px-4 text-sm font-semibold disabled:opacity-40"><ArrowLeft size={16} /> Oldingi</button>
            {index < total - 1 ? (
              <button onClick={() => setIndex(index + 1)} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white">Keyingi <ArrowRight size={16} /></button>
            ) : (
              <button onClick={finish} disabled={busy} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-gold-500 px-5 text-sm font-semibold text-navy-950 disabled:opacity-60">
                <CheckCircle2 size={16} /> {busy ? "Yuborilmoqda…" : `Yakunlash (${answered}/${total})`}
              </button>
            )}
          </div>
        </div>
      </Page>
    );
  }

  if (phase === "result" && result) {
    return (
      <Page className="max-w-3xl">
        <Back />
        <section className="flex flex-col items-center rounded-3xl border bg-white p-8 text-center shadow-card">
          <Ring value={result.score} size={130} stroke={12} color={result.score >= 70 ? "#10b981" : result.score >= 55 ? "#f59e0b" : "#ef4444"}>
            <div>
              <p className="font-heading text-3xl font-semibold text-navy-900">{result.score}</p>
              <p className="text-[10px] text-muted-foreground">/ 100</p>
            </div>
          </Ring>
          <h1 className="mt-4 text-2xl font-semibold text-navy-900">{result.score >= 86 ? "A’lo natija!" : result.score >= 70 ? "Yaxshi natija" : "Yana mashq qiling"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{result.correct} ta to‘g‘ri javob, jami {result.total} ta savol</p>
          {quiz.max_attempts - quiz.attempts_used - 1 > 0 && !quiz.is_overdue && (
            <button onClick={start} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-semibold text-navy-700 hover:bg-navy-50"><RotateCcw size={16} /> Qayta urinish</button>
          )}
        </section>
        <Panel title="Javoblar tahlili" icon={ListChecks} className="mt-6">
          <ol className="space-y-3">
            {quiz.questions.map((q: any, i: number) => {
              const r = result.review[i];
              return (
                <li key={i} className={cn("rounded-2xl border p-4", r.ok ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50")}>
                  <p className="flex items-start gap-2 text-sm font-semibold text-navy-900">
                    {r.ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={17} className="mt-0.5 shrink-0 text-rose-600" />}
                    {i + 1}. {q.text}
                  </p>
                  <p className="ml-6 mt-1.5 text-xs text-slate-600">
                    Sizning javobingiz: <b>{r.chosen === null ? "—" : q.options[r.chosen]}</b>
                    {!r.ok && <> · To‘g‘ri javob: <b className="text-emerald-700">{q.options[r.correct]}</b></>}
                  </p>
                </li>
              );
            })}
          </ol>
        </Panel>
      </Page>
    );
  }

  const deadline = timeLeft(quiz.deadline);
  return (
    <Page className="max-w-3xl">
      <Back />
      <section className="rounded-3xl bg-gradient-to-br from-navy-700 to-navy-950 p-6 text-white shadow-lift md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">{quiz.course_title}</p>
        <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{quiz.title}</h1>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          {[["Savollar", quiz.question_count], ["Vaqt", `${quiz.time_limit_min} daq`], ["Urinish", `${quiz.attempts_used}/${quiz.max_attempts}`]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-white/10 p-3 ring-1 ring-inset ring-white/15">
              <p className="font-heading text-xl font-semibold">{v as string}</p>
              <p className="text-[11px] text-navy-200">{l as string}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-sm text-navy-200"><Clock size={15} /> Muddat: <b className="text-white">{fmtDateTime(quiz.deadline)}</b> {!deadline.past && <span>· {deadline.text} qoldi</span>}</p>
        {blocked ? (
          <div className="mt-5 rounded-xl bg-white/10 p-3 text-sm">{quiz.is_overdue ? "Test muddati tugagan." : "Barcha urinishlar ishlatilgan."}</div>
        ) : (
          <button onClick={start} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-500 text-sm font-semibold text-navy-950 hover:bg-gold-400 sm:w-auto sm:px-8">
            <Play size={17} /> Testni boshlash
          </button>
        )}
      </section>
      <div className="mt-5"><Notice tone="gold">Boshlaganingizdan so‘ng taymer ishga tushadi. Vaqt tugasa javoblar avtomatik yuboriladi. Eng yaxshi natija hisobga olinadi.</Notice></div>
      {quiz.my_attempts?.length > 0 && (
        <Panel title="Urinishlarim" className="mt-6">
          <ul className="divide-y">
            {quiz.my_attempts.map((a: any, i: number) => (
              <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                <span>{i + 1}-urinish · <span className="text-muted-foreground">{fmtDateTime(a.finished_at)}</span></span>
                <Pill tone={gradeTone(a.score)}>{a.correct}/{a.total} · {a.score}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </Page>
  );
}

function TeacherView({ quiz }: { quiz: any }) {
  const { data, loading } = useLoad(() => getQuizResults(quiz.id), [quiz.id]);
  const rows = useMemo(() => ((data ?? []) as any[]).sort((a, b) => (b.best_score ?? -1) - (a.best_score ?? -1)), [data]);
  const done = rows.filter((r) => r.attempts > 0);
  return (
    <Page>
      <Back />
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">{quiz.course_title}</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-900 md:text-3xl">{quiz.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{quiz.question_count} savol · {quiz.time_limit_min} daqiqa · {quiz.max_attempts} urinish · muddat {fmtDateTime(quiz.deadline)}</p>
      </header>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Topshirganlar" value={`${done.length}/${rows.length}`} tone="navy" />
        <Stat label="O‘rtacha ball" value={quiz.average_score ?? "—"} tone="green" />
        <Stat label="Topshirmaganlar" value={rows.length - done.length} tone="amber" className="col-span-2 lg:col-span-1" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Natijalar">
          {loading ? <PageSkeleton rows={1} /> : rows.length ? (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.student} className="flex items-center gap-3 py-2.5">
                  <Avatar name={r.student_name} size={34} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.student_name}</span>
                  <span className="text-xs text-muted-foreground">{r.attempts} urinish</span>
                  {r.best_score === null ? <Pill>Topshirmagan</Pill> : <Pill tone={gradeTone(r.best_score)}>{r.best_score}</Pill>}
                </li>
              ))}
            </ul>
          ) : <Empty title="Talabalar yo‘q" />}
        </Panel>
        <Panel title="Savollar va javoblar" icon={ListChecks}>
          <ol className="space-y-3">
            {quiz.questions.map((q: any, i: number) => (
              <li key={i} className="text-sm">
                <p className="font-semibold text-navy-900">{i + 1}. {q.text}</p>
                <ul className="mt-1 space-y-0.5">
                  {q.options.map((o: string, k: number) => (
                    <li key={k} className={cn("text-xs", k === q.correct ? "font-semibold text-emerald-700" : "text-slate-500")}>{String.fromCharCode(65 + k)}) {o} {k === q.correct && "✓"}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </Page>
  );
}
