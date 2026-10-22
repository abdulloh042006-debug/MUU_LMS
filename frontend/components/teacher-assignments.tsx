"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardList, Copy, FileUp, Minus, Pencil, Plus, Repeat, Search, Trash2, Users, X } from "lucide-react";
import { createAssignment, getAssignments, getCourses, removeAssignment, updateAssignment } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Page, PageHeader, PageSkeleton, Pill, Progress, Segmented, settle, useLoad } from "@/components/mu/kit";
import { courseColor, fmtDateTime, timeLeft, tz } from "@/lib/format";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200";

/** ISO vaqtni Toshkent bo‘yicha `datetime-local` qiymatiga aylantiradi. */
function toLocalInput(iso: string) {
  const p = tz(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}
/** `datetime-local` qiymatini (Toshkent vaqti) ISO ga aylantiradi. */
const fromLocalInput = (v: string) => new Date(`${v}:00+05:00`).toISOString();

/** Bugundan `days` kun keyin, Toshkent bo‘yicha soat `hh:mm`. */
function preset(days: number, hh = 23, mm = 59) {
  const p = tz(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(hh)}:${pad(mm)}`;
}

type Draft = { id?: number; course: string; title: string; description: string; deadline: string; max_attempts: number; allow_late: boolean };

export function TeacherAssignments() {
  const { data, loading, error, reload } = useLoad(() => settle({ assignments: getAssignments, courses: getCourses }));
  const [tab, setTab] = useState<"active" | "past" | "all">("active");
  const [course, setCourse] = useState("all");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState<any | null>(null);
  const [notice, setNotice] = useState("");

  const courses = ((data?.courses ?? []) as any[]).filter((c) => !c.is_archived);
  const all = useMemo(() => (data?.assignments ?? []) as any[], [data]);
  const now = Date.now();
  const list = useMemo(
    () =>
      all
        .filter((a) => (course === "all" ? true : String(a.course) === course))
        .filter((a) => (tab === "active" ? new Date(a.due_date).getTime() >= now : tab === "past" ? new Date(a.due_date).getTime() < now : true))
        .filter((a) => `${a.title} ${a.course_title}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (tab === "past" ? +new Date(b.due_date) - +new Date(a.due_date) : +new Date(a.due_date) - +new Date(b.due_date))),
    [all, course, tab, q, now],
  );

  function openNew() {
    setFile(null);
    setFormError("");
    setDraft({ course: course !== "all" ? course : String(courses[0]?.id ?? ""), title: "", description: "", deadline: preset(7), max_attempts: 3, allow_late: false });
  }
  function openEdit(a: any) {
    setFile(null);
    setFormError("");
    setDraft({ id: Number(a.id), course: String(a.course), title: a.title, description: a.description ?? "", deadline: toLocalInput(a.due_date), max_attempts: a.max_attempts, allow_late: !!a.allow_late });
  }
  function duplicate(a: any) {
    openEdit(a);
    setDraft((d) => d && { ...d, id: undefined, title: `${a.title} (nusxa)`, deadline: preset(7) });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const deadlineIso = fromLocalInput(draft.deadline);
    if (!draft.id && new Date(deadlineIso).getTime() < Date.now()) return setFormError("Muddat kelajakdagi vaqt bo‘lishi kerak.");
    if (file && file.size > 20 * 1024 * 1024) return setFormError("Fayl 20 MB dan oshmasin.");
    setBusy(true);
    setFormError("");
    try {
      if (draft.id) {
        await updateAssignment(draft.id, { title: draft.title, description: draft.description, deadline: deadlineIso, max_attempts: draft.max_attempts, allow_late: draft.allow_late });
        setNotice("Topshiriq yangilandi.");
      } else {
        const fd = new FormData();
        fd.set("course", draft.course);
        fd.set("title", draft.title);
        fd.set("description", draft.description);
        fd.set("deadline", deadlineIso);
        fd.set("max_attempts", String(draft.max_attempts));
        fd.set("allow_late", draft.allow_late ? "true" : "false");
        if (file) fd.set("file", file);
        await createAssignment(fd);
        setNotice("Topshiriq yaratildi — talabalarga bildirishnoma yuborildi va muddat taqvimga qo‘shildi.");
      }
      setDraft(null);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function doRemove() {
    if (!confirm) return;
    setBusy(true);
    try {
      await removeAssignment(Number(confirm.id));
      setNotice("Topshiriq o‘chirildi.");
      setConfirm(null);
      reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const deadlinePreview = draft?.deadline ? timeLeft(fromLocalInput(draft.deadline)) : null;

  return (
    <Page>
      <PageHeader
        eyebrow="LMS"
        title="Topshiriqlar"
        description="Talabalar fayl yuklaydigan topshiriqlar: muddat, urinishlar soni va kech topshirish qoidasi."
        actions={
          <button onClick={openNew} disabled={!courses.length} className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white shadow-card hover:bg-navy-800 disabled:opacity-50">
            <Plus size={17} /> Yangi topshiriq
          </button>
        }
      />
      {notice && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-emerald-50 p-3.5 text-sm text-emerald-800" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Yopish"><X size={16} /></button>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Faol", count: all.filter((a) => new Date(a.due_date).getTime() >= now).length },
            { value: "past", label: "Muddati o‘tgan", count: all.filter((a) => new Date(a.due_date).getTime() < now).length },
            { value: "all", label: "Hammasi" },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={course} onChange={(e) => setCourse(e.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm shadow-card" aria-label="Kurs bo‘yicha saralash">
            <option value="all">Barcha kurslar</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <label className="flex h-10 items-center gap-2 rounded-xl border bg-white px-3 shadow-card sm:w-56">
            <Search size={15} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish…" className="w-full bg-transparent text-sm outline-none" />
          </label>
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading ? (
        <PageSkeleton rows={3} />
      ) : list.length ? (
        <ul className="space-y-3">
          {list.map((a) => {
            const left = timeLeft(a.due_date);
            const col = courseColor(a.course);
            const submitted = a.submitted_students ?? a.submission_count ?? 0;
            const students = a.student_count ?? 0;
            const pending = (a.submission_count ?? 0) - (a.graded_count ?? 0);
            return (
              <li key={a.id} className="rounded-2xl border bg-white p-4 shadow-card md:p-5" style={{ borderLeft: `4px solid ${col.dot}` }}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/assignments/${a.id}`} className="text-[15px] font-semibold text-navy-900 hover:underline">{a.title}</Link>
                      <Pill tone={left.past ? "neutral" : left.urgent ? "red" : left.soon ? "amber" : "blue"}>{left.past ? "Muddat tugagan" : `${left.text} qoldi`}</Pill>
                    </div>
                    <p className="mt-1 text-xs font-semibold" style={{ color: col.text }}>{a.course_title}</p>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> {fmtDateTime(a.due_date)}</span>
                      <span className="inline-flex items-center gap-1"><Repeat size={13} /> {a.max_attempts} ta urinish</span>
                      <span>{a.allow_late ? "Kech topshirish mumkin" : "Kech topshirish yopiq"}</span>
                    </div>
                  </div>
                  <div className="w-full md:w-56">
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users size={12} /> Topshirgan</span>
                      <b className="text-navy-900">{submitted}/{students || "—"}</b>
                    </div>
                    <Progress value={students ? (submitted / students) * 100 : 0} thin tone="gold" />
                    {pending > 0 && (
                      <Link href="/review-queue" className="mt-1.5 inline-block text-[11px] font-semibold text-amber-700 hover:underline">{pending} ta ish baholanmagan →</Link>
                    )}
                  </div>
                  <div className="flex gap-1.5 md:flex-col lg:flex-row">
                    <button onClick={() => openEdit(a)} className="grid size-9 place-items-center rounded-lg border text-navy-700 hover:bg-navy-50" aria-label="Tahrirlash" title="Tahrirlash"><Pencil size={15} /></button>
                    <button onClick={() => duplicate(a)} className="grid size-9 place-items-center rounded-lg border text-navy-700 hover:bg-navy-50" aria-label="Nusxa olish" title="Nusxa olish"><Copy size={15} /></button>
                    <button onClick={() => setConfirm(a)} className="grid size-9 place-items-center rounded-lg border text-rose-600 hover:bg-rose-50" aria-label="O‘chirish" title="O‘chirish"><Trash2 size={15} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty icon={ClipboardList} title="Topshiriq yo‘q" text="“Yangi topshiriq” tugmasi orqali talabalarga vazifa bering." action={<button onClick={openNew} className="rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white">Yangi topshiriq</button>} />
      )}

      {/* Yaratish / tahrirlash oynasi */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={draft.id ? "Topshiriqni tahrirlash" : "Yangi topshiriq"}>
          <form onSubmit={save} className="thin-scroll max-h-[94vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy-900">{draft.id ? "Topshiriqni tahrirlash" : "Yangi topshiriq"}</h2>
              <button type="button" onClick={() => setDraft(null)} aria-label="Yopish" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={18} /></button>
            </div>
            {formError && <ErrorNote message={formError} />}

            <label className="block text-sm font-medium">Kurs <span className="text-rose-500">*</span>
              <select value={draft.course} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, course: e.target.value })} required className={`${field} mt-1.5 disabled:bg-slate-50`}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Nomi <span className="text-rose-500">*</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={200} placeholder="Masalan: Laboratoriya ishi №3" className={`${field} mt-1.5`} />
            </label>
            <label className="block text-sm font-medium">Ko‘rsatma
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4} placeholder="Nima qilish kerak, qanday formatda yuklash, baholash mezonlari…" className={`${field} mt-1.5 h-auto py-2.5`} />
            </label>

            {/* Muddat */}
            <div>
              <p className="text-sm font-medium">Topshirish muddati <span className="text-rose-500">*</span> <span className="font-normal text-muted-foreground">(Toshkent vaqti)</span></p>
              <input type="datetime-local" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} required className={`${field} mt-1.5`} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[["Bugun 23:59", 0], ["Ertaga 23:59", 1], ["3 kun", 3], ["1 hafta", 7], ["2 hafta", 14]].map(([label, d]) => (
                  <button type="button" key={label as string} onClick={() => setDraft({ ...draft, deadline: preset(d as number) })} className="rounded-full border px-3 py-1 text-xs font-medium text-navy-700 hover:border-navy-300 hover:bg-navy-50">
                    {label as string}
                  </button>
                ))}
              </div>
              {deadlinePreview && <p className={cn("mt-1.5 text-xs", deadlinePreview.past ? "text-rose-600" : "text-muted-foreground")}>{deadlinePreview.past ? "Bu vaqt o‘tib ketgan" : `Talabalarda ${deadlinePreview.text} vaqt bo‘ladi`}</p>}
            </div>

            {/* Urinishlar */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Urinishlar soni</p>
                <div className="mt-1.5 flex h-11 items-center justify-between rounded-xl border px-1.5">
                  <button type="button" onClick={() => setDraft({ ...draft, max_attempts: Math.max(1, draft.max_attempts - 1) })} className="grid size-8 place-items-center rounded-lg hover:bg-slate-100" aria-label="Kamaytirish"><Minus size={15} /></button>
                  <span className="font-heading text-lg font-semibold text-navy-900">{draft.max_attempts}</span>
                  <button type="button" onClick={() => setDraft({ ...draft, max_attempts: Math.min(10, draft.max_attempts + 1) })} className="grid size-8 place-items-center rounded-lg hover:bg-slate-100" aria-label="Oshirish"><Plus size={15} /></button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Talaba javobni necha marta yuklay oladi (oxirgisi baholanadi).</p>
              </div>
              <div>
                <p className="text-sm font-medium">Kech topshirish</p>
                <button type="button" onClick={() => setDraft({ ...draft, allow_late: !draft.allow_late })} className={cn("mt-1.5 flex h-11 w-full items-center justify-between rounded-xl border px-3 text-sm", draft.allow_late && "border-amber-300 bg-amber-50")} aria-pressed={draft.allow_late}>
                  <span>{draft.allow_late ? "Ruxsat berilgan" : "Ruxsat yo‘q"}</span>
                  <span className={cn("relative h-6 w-11 rounded-full transition", draft.allow_late ? "bg-amber-500" : "bg-slate-300")}>
                    <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition", draft.allow_late ? "left-[22px]" : "left-0.5")} />
                  </span>
                </button>
                <p className="mt-1 text-[11px] text-muted-foreground">Yoqilsa, muddatdan keyin ham yuklash mumkin — “kech” deb belgilanadi.</p>
              </div>
            </div>

            {!draft.id && (
              <div>
                <p className="text-sm font-medium">Topshiriq fayli <span className="font-normal text-muted-foreground">(ixtiyoriy)</span></p>
                <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/40 px-4 py-3.5 hover:border-gold-400 hover:bg-gold-50">
                  <IconChip icon={FileUp} tone="navy" size={34} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy-800">{file ? file.name : "Shart, shablon yoki misol faylini tanlang"}</span>
                  {file && <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }} aria-label="Olib tashlash" className="text-slate-400 hover:text-rose-600"><X size={15} /></button>}
                  <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setDraft(null)} className="h-11 flex-1 rounded-xl border text-sm font-semibold hover:bg-slate-50">Bekor qilish</button>
              <button disabled={busy} className="h-11 flex-1 rounded-xl bg-navy-700 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? "Saqlanmoqda…" : draft.id ? "Saqlash" : "Yaratish va e’lon qilish"}</button>
            </div>
          </form>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/50 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-pop">
            <h2 className="text-lg font-semibold text-navy-900">Topshiriqni o‘chirasizmi?</h2>
            <p className="mt-2 text-sm text-muted-foreground">“{confirm.title}” va unga yuborilgan {confirm.submission_count ?? 0} ta javob o‘chadi.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirm(null)} className="h-11 flex-1 rounded-xl border text-sm font-semibold hover:bg-slate-50">Bekor</button>
              <button onClick={doRemove} disabled={busy} className="h-11 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">O‘chirish</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
