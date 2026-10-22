"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Download, FileText, Search } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { downloadFile, getBooks } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Page, PageHeader, PageSkeleton, Pill, useLoad } from "@/components/mu/kit";
import { courseColor, fmtDay } from "@/lib/format";
import { cn } from "@/lib/utils";

function Content() {
  const params = useSearchParams();
  const router = useRouter();
  const course = params.get("course");
  const { data, loading, error, reload } = useLoad(() => getBooks());
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [dlError, setDlError] = useState("");

  const books = useMemo(() => ((data ?? []) as any[]).filter((b) => !course || String(b.course) === course), [data, course]);
  const subjects = useMemo(() => [...new Set(books.map((b) => b.course_title).filter(Boolean))] as string[], [books]);
  const shown = books.filter((b) => (subject === "all" || b.course_title === subject) && `${b.title} ${b.subject} ${b.course_title}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page>
      <PageHeader
        eyebrow="Kutubxona"
        title="O‘quv materiallari"
        description="Ustozlar joylagan darslik, slayd va amaliy mashqlar."
        actions={
          <label className="flex h-10 w-full items-center gap-2 rounded-xl border bg-white px-3 shadow-card md:w-64">
            <Search size={16} className="text-slate-400" />
            <input aria-label="Materiallarni qidirish" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish…" className="w-full bg-transparent text-sm outline-none" />
          </label>
        }
      />
      {subjects.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {["all", ...subjects].map((s) => (
            <button key={s} onClick={() => setSubject(s)} className={cn("whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition", subject === s ? "border-navy-700 bg-navy-700 text-white" : "bg-white text-slate-600 hover:border-navy-300")}>
              {s === "all" ? `Hammasi · ${books.length}` : `${s} · ${books.filter((b) => b.course_title === s).length}`}
            </button>
          ))}
        </div>
      )}
      {(error || dlError) && <div className="mb-4"><ErrorNote message={error || dlError} onRetry={error ? reload : undefined} /></div>}
      {course && (
        <button onClick={() => router.push("/materials")} className="mb-4 text-xs font-semibold text-navy-600 underline">
          Barcha kurslar materiallarini ko‘rsatish
        </button>
      )}
      {loading ? (
        <PageSkeleton rows={2} />
      ) : shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((b) => {
            const col = courseColor(b.course);
            return (
              <article key={b.id} className="flex flex-col rounded-2xl border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start gap-3">
                  <IconChip icon={FileText} tone="violet" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug text-navy-900">{b.title}</h3>
                    <p className="mt-1 truncate text-xs font-medium" style={{ color: col.text }}>{b.course_title}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Pill>{b.subject}</Pill>
                    <span className="text-[11px] text-muted-foreground">{fmtDay(b.uploaded_at)}</span>
                  </div>
                  <button onClick={() => downloadFile(b.file).catch((e) => setDlError(e instanceof Error ? e.message : String(e)))} aria-label={`${b.title} — yuklab olish`} className="grid size-9 place-items-center rounded-xl bg-navy-50 text-navy-700 transition hover:bg-navy-100">
                    <Download size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon={BookOpen} title="Material topilmadi" text="Qidiruv yoki filtrni o‘zgartirib ko‘ring." />
      )}
    </Page>
  );
}

export function MaterialsView() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<Page><PageSkeleton /></Page>}>
        <Content />
      </Suspense>
    </ProtectedRoute>
  );
}
