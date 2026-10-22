"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ClipboardCheck, Download } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { downloadFile, getTeacherSubmissions, gradeSubmission } from "@/lib/api-service";
import { Avatar, Empty, ErrorNote, Page, PageHeader, PageSkeleton, Pill, useLoad } from "@/components/mu/kit";
import { fmtDateTime } from "@/lib/format";

export default function ReviewQueue() {
  const { data, loading, error, reload } = useLoad(() => getTeacherSubmissions());
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const pending = useMemo(() => ((data ?? []) as any[]).filter((s) => s.grade === null).sort((a, b) => +new Date(a.submitted_at) - +new Date(b.submitted_at)), [data]);

  async function grade(e: FormEvent<HTMLFormElement>, s: any) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(s.id);
    setErr("");
    try {
      await gradeSubmission(s.id, Number(fd.get("grade")), String(fd.get("feedback") || ""));
      reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(null);
    }
  }

  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="LMS" title="Tekshirish navbati" description="Eng eski yuborilgan ishlar birinchi turadi. Baho qo‘ying va izoh yozing." />
        {(error || err) && <div className="mb-4"><ErrorNote message={error || err} onRetry={error ? reload : undefined} /></div>}
        {loading ? <PageSkeleton rows={2} /> : pending.length ? (
          <ul className="space-y-3">
            {pending.map((s) => (
              <li key={s.id} className="rounded-2xl border bg-white p-4 shadow-card md:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={s.student_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900">{s.student_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.assignment.course_title} · {s.assignment.title} · {s.attempt}-urinish</p>
                  </div>
                  {s.is_late && <Pill tone="red">Kech</Pill>}
                  <span className="text-xs text-muted-foreground">{fmtDateTime(s.submitted_at)}</span>
                  <button onClick={() => downloadFile(s.file).catch((x) => setErr(x.message))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50"><Download size={14} /> Fayl</button>
                </div>
                <form onSubmit={(e) => grade(e, s)} className="mt-4 grid gap-3 sm:grid-cols-[110px_1fr_auto]">
                  <input name="grade" type="number" min={0} max={100} required placeholder="Baho /100" aria-label="Baho" className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-200" />
                  <input name="feedback" placeholder="Izoh (ixtiyoriy)" aria-label="Izoh" className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-200" />
                  <button disabled={busy === s.id} className="h-11 rounded-xl bg-navy-700 px-6 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{busy === s.id ? "…" : "Baholash"}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : <Empty icon={ClipboardCheck} title="Hamma ish baholangan 🎉" />}
      </Page>
    </StaffPage>
  );
}
