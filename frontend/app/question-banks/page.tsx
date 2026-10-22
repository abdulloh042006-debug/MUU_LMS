"use client";

import { useState, type FormEvent } from "react";
import { HelpCircle, Plus } from "lucide-react";
import { StaffPage } from "@/components/mu/staff";
import { createQuestionBank, getCourses, getQuestionBanks } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Page, PageHeader, PageSkeleton, Pill, settle, useLoad } from "@/components/mu/kit";
import { courseColor, fmtDay } from "@/lib/format";

export default function QuestionBanks() {
  const { data, loading, error, reload } = useLoad(() => settle({ banks: getQuestionBanks, courses: getCourses }));
  const [open, setOpen] = useState(false);
  const banks = (data?.banks ?? []) as any[];
  const courses = (data?.courses ?? []) as any[];

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await createQuestionBank({ title: fd.get("title"), course: Number(fd.get("course")) });
    setOpen(false);
    reload();
  }

  return (
    <StaffPage>
      <Page>
        <PageHeader eyebrow="LMS" title="Savollar banki" description="Test va nazoratlar uchun savollar to‘plami." actions={<button onClick={() => setOpen(!open)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white hover:bg-navy-800"><Plus size={17} /> Yangi bank</button>} />
        {open && (
          <form onSubmit={add} className="mb-5 grid gap-3 rounded-2xl border bg-white p-4 shadow-card sm:grid-cols-[1fr_220px_auto]">
            <input name="title" required placeholder="Bank nomi" className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-gold-500" />
            <select name="course" className="h-11 rounded-xl border bg-white px-3 text-sm">{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            <button className="h-11 rounded-xl bg-navy-700 px-6 text-sm font-semibold text-white">Yaratish</button>
          </form>
        )}
        {!data && error ? <ErrorNote message={error} onRetry={reload} /> : loading ? <PageSkeleton rows={2} /> : !banks.length && data?.banks === null ? <ErrorNote message="Bu bo‘lim hozircha faqat demo rejimda mavjud." /> : banks.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {banks.map((b) => (
              <div key={b.id} className="flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-card">
                <IconChip icon={HelpCircle} tone="violet" size={46} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{b.title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: courseColor(b.course).text }}>{b.course_title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Yangilangan: {fmtDay(b.updated_at)}</p>
                </div>
                <Pill tone="navy">{b.questions} savol</Pill>
              </div>
            ))}
          </div>
        ) : <Empty icon={HelpCircle} title="Bank yo‘q" />}
      </Page>
    </StaffPage>
  );
}
