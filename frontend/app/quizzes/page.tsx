"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, ListChecks, Minus, Plus, Timer, Trash2, X } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { createQuiz, getCourses, getQuizzes, removeQuiz } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Notice, Page, PageHeader, PageSkeleton, Pill, Segmented, settle, useLoad } from "@/components/mu/kit";
import { courseColor, fmtDateTime, gradeTone, timeLeft, tz } from "@/lib/format";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200";

export default function QuizzesPage() {
  return (
    <ProtectedRoute>
      <Switch />
    </ProtectedRoute>
  );
}

function Switch() {
  const { user } = useAuth();
  return user?.role === "student" ? <StudentQuizzes /> : <TeacherQuizzes />;
}

function QuizCard({ z, teacher, onRemove }: { z: any; teacher?: boolean; onRemove?: () => void }) {
  const left = timeLeft(z.deadline);
  const col = courseColor(z.course);
  const done = z.best_score !== null && z.best_score !== undefined;
  return (
    <li className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card transition hover:shadow-lift" style={{ borderLeft: `4px solid ${col.dot}` }}>
      <IconChip icon={done ? CheckCircle2 : ListChecks} tone={done ? "green" : "violet"} />
      <Link href={`/quizzes/${z.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-navy-900 md:text-[15px]">{z.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="font-semibold" style={{ color: col.text }}>{z.course_title}</span> · {z.question_count} savol · {z.time_limit_min} daq · {fmtDateTime(z.deadline)}
        </p>
      </Link>
      {teacher ? (
        <>
          <Pill tone="navy">{z.attempt_count} topshirgan{z.average_score !== null ? ` · o‘rtacha ${z.average_score}` : ""}</Pill>
          <button onClick={onRemove} aria-label="O‘chirish" className="grid size-9 place-items-center rounded-lg border text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
        </>
      ) : done ? (
        <Pill tone={gradeTone(z.best_score)}>{z.best_score} ball</Pill>
      ) : (
        <Pill tone={left.past ? "red" : left.urgent ? "red" : left.soon ? "amber" : "neutral"}>{left.past ? "Muddati o‘tgan" : left.text}</Pill>
      )}
    </li>
  );
}

function StudentQuizzes() {
  const { data, loading, error, reload } = useLoad(() => getQuizzes());
  const [tab, setTab] = useState<"open" | "done">("open");
  const all = useMemo(() => (data ?? []) as any[], [data]);
  const open = all.filter((z) => z.best_score === null && !z.is_overdue);
  const done = all.filter((z) => z.best_score !== null || z.is_overdue);
  const list = tab === "open" ? open : done;
  return (
    <Page>
      <PageHeader eyebrow="O‘qish" title="Testlar" description="Kurslar bo‘yicha onlayn testlar — natija darhol chiqadi." />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: "open", label: "Topshirilishi kerak", count: open.length }, { value: "done", label: "Yakunlangan", count: done.length }]} />
      {error ? <ErrorNote message="Testlar bo‘limi hozircha faqat demo rejimda mavjud." onRetry={reload} /> : loading ? <PageSkeleton rows={2} /> : list.length ? (
        <ul className="space-y-3">{list.map((z) => <QuizCard key={z.id} z={z} />)}</ul>
      ) : <Empty icon={ListChecks} title={tab === "open" ? "Hozircha ochiq test yo‘q" : "Yakunlangan test yo‘q"} />}
    </Page>
  );
}

type Q = { text: string; options: string[]; correct: number };
const blankQ = (): Q => ({ text: "", options: ["", "", "", ""], correct: 0 });

function TeacherQuizzes() {
  const { data, loading, error, reload } = useLoad(() => settle({ quizzes: getQuizzes, courses: getCourses }));
  const [open, setOpen] = useState(false);
  const [qs, setQs] = useState<Q[]>([blankQ()]);
  const [meta, setMeta] = useState({ course: "", title: "", time: 10, attempts: 1, deadline: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const courses = ((data?.courses ?? []) as any[]).filter((c) => !c.is_archived);
  const list = (data?.quizzes ?? []) as any[];

  function openNew() {
    const p = tz(Date.now() + 7 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    setMeta({ course: String(courses[0]?.id ?? ""), title: "", time: 10, attempts: 1, deadline: `${p.y}-${pad(p.m)}-${pad(p.d)}T23:59` });
    setQs([blankQ()]);
    setErr("");
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const bad = qs.findIndex((q) => !q.text.trim() || q.options.filter((o) => o.trim()).length < 2 || !q.options[q.correct]?.trim());
    if (bad >= 0) return setErr(`${bad + 1}-savol: matn, kamida 2 ta variant va to‘g‘ri javobni belgilang.`);
    setBusy(true);
    setErr("");
    try {
      await createQuiz({
        course: Number(meta.course),
        title: meta.title,
        time_limit_min: meta.time,
        max_attempts: meta.attempts,
        deadline: new Date(`${meta.deadline}:00+05:00`).toISOString(),
        questions: qs.map((q) => {
          const opts = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
          return { text: q.text.trim(), options: opts.map((x) => x.o), correct: opts.findIndex((x) => x.i === q.correct) };
        }),
      });
      setOpen(false);
      reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  const setQ = (i: number, patch: Partial<Q>) => setQs(qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  return (
    <Page>
      <PageHeader
        eyebrow="LMS"
        title="Testlar"
        description="Avtomatik baholanadigan onlayn testlar yarating va natijalarni kuzating."
        actions={<button onClick={openNew} disabled={!courses.length} className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"><Plus size={17} /> Yangi test</button>}
      />
      {error ? <ErrorNote message={error} onRetry={reload} /> : loading ? <PageSkeleton rows={2} /> : data?.quizzes === null ? (
        <ErrorNote message="Testlar bo‘limi hozircha faqat demo rejimda mavjud." />
      ) : list.length ? (
        <ul className="space-y-3">{list.map((z) => <QuizCard key={z.id} z={z} teacher onRemove={async () => { await removeQuiz(z.id); reload(); }} />)}</ul>
      ) : <Empty icon={ListChecks} title="Test yo‘q" />}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Yangi test">
          <form onSubmit={save} className="thin-scroll max-h-[94vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy-900">Yangi test</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={18} /></button>
            </div>
            {err && <ErrorNote message={err} />}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">Kurs
                <select value={meta.course} onChange={(e) => setMeta({ ...meta, course: e.target.value })} className={`${field} mt-1.5`}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
              </label>
              <label className="block text-sm font-medium">Nomi
                <input required value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Masalan: 2-modul testi" className={`${field} mt-1.5`} />
              </label>
              <label className="block text-sm font-medium">Muddat (Toshkent)
                <input type="datetime-local" required value={meta.deadline} onChange={(e) => setMeta({ ...meta, deadline: e.target.value })} className={`${field} mt-1.5`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Vaqt (daq)
                  <input type="number" min={1} max={180} value={meta.time} onChange={(e) => setMeta({ ...meta, time: Number(e.target.value) })} className={`${field} mt-1.5`} />
                </label>
                <label className="block text-sm font-medium">Urinish
                  <input type="number" min={1} max={10} value={meta.attempts} onChange={(e) => setMeta({ ...meta, attempts: Number(e.target.value) })} className={`${field} mt-1.5`} />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              {qs.map((q, i) => (
                <fieldset key={i} className="rounded-2xl border bg-slate-50/60 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <legend className="text-sm font-semibold text-navy-900">{i + 1}-savol</legend>
                    {qs.length > 1 && <button type="button" onClick={() => setQs(qs.filter((_, k) => k !== i))} aria-label="Savolni o‘chirish" className="text-slate-400 hover:text-rose-600"><Minus size={16} /></button>}
                  </div>
                  <input value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Savol matni" className={field} />
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {q.options.map((o, k) => (
                      <label key={k} className={cn("flex items-center gap-2 rounded-xl border bg-white px-2.5", q.correct === k && "border-emerald-400 ring-2 ring-emerald-100")}>
                        <input type="radio" name={`correct-${i}`} checked={q.correct === k} onChange={() => setQ(i, { correct: k })} aria-label={`${String.fromCharCode(65 + k)} variant to‘g‘ri`} className="accent-emerald-600" />
                        <span className="text-xs font-bold text-slate-400">{String.fromCharCode(65 + k)}</span>
                        <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder="Variant" className="h-10 flex-1 bg-transparent text-sm outline-none" />
                      </label>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">To‘g‘ri javobni chapdagi doiracha bilan belgilang.</p>
                </fieldset>
              ))}
              <button type="button" onClick={() => setQs([...qs, blankQ()])} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold text-navy-700 hover:border-gold-400 hover:bg-gold-50"><Plus size={16} /> Savol qo‘shish</button>
            </div>
            <Notice tone="gold"><span className="inline-flex items-center gap-1.5"><Timer size={13} /> Talabalar boshlaganda taymer ishlaydi; natija avtomatik hisoblanadi.</span></Notice>
            <div className="flex gap-3">
              <button type="button" onClick={() => setOpen(false)} className="h-11 flex-1 rounded-xl border text-sm font-semibold hover:bg-slate-50">Bekor qilish</button>
              <button disabled={busy} className="h-11 flex-1 rounded-xl bg-navy-700 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? "Saqlanmoqda…" : `E’lon qilish (${qs.length} savol)`}</button>
            </div>
          </form>
        </div>
      )}
    </Page>
  );
}
