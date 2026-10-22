"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Building2, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { AdminPage } from "@/components/mu/admin";
import { createGroup, getAdminUsers, getFaculties, getGroups, removeGroup, updateGroup } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Page, PageHeader, PageSkeleton, Pill, Stat, settle, useLoad } from "@/components/mu/kit";

const field = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200";

export default function GroupsPage() {
  const { data, loading, error, reload } = useLoad(() => settle({ groups: getGroups, faculties: getFaculties, users: getAdminUsers }));
  const [edit, setEdit] = useState<any | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [faculty, setFaculty] = useState("all");
  const groups = useMemo(() => ((data?.groups ?? []) as any[]).filter((g) => faculty === "all" || String(g.faculty) === faculty), [data, faculty]);
  const faculties = (data?.faculties ?? []) as any[];
  const teachers = ((data?.users ?? []) as any[]).filter((u) => u.role === "ustoz");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget).entries());
    setBusy(true);
    setErr("");
    try {
      if (edit?.id) await updateGroup(edit.id, d);
      else await createGroup(d);
      setEdit(null);
      reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage>
      <Page>
        <PageHeader
          eyebrow="Administrator"
          title="Fakultet va guruhlar"
          description="Guruhlarni yarating, kurator biriktiring va talabalar sonini kuzating."
          actions={<button onClick={() => { setEdit({}); setErr(""); }} className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white hover:bg-navy-800"><Plus size={17} /> Yangi guruh</button>}
        />
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading ? <PageSkeleton rows={2} /> : data?.groups === null ? <ErrorNote message="Bu bo‘lim hozircha faqat demo rejimda mavjud." /> : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {faculties.map((f) => (
                <button key={f.id} onClick={() => setFaculty(faculty === String(f.id) ? "all" : String(f.id))} className="text-left">
                  <Stat label={f.short} value={((data?.groups ?? []) as any[]).filter((g) => g.faculty === f.id).length} hint={f.name} icon={Building2} tone={faculty === String(f.id) ? "gold" : "navy"} className={faculty === String(f.id) ? "ring-2 ring-gold-400" : ""} />
                </button>
              ))}
            </div>
            {groups.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.map((g) => (
                  <div key={g.id} className="rounded-2xl border bg-white p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <IconChip icon={Users} tone="navy" />
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-lg font-semibold text-navy-900">{g.code}</p>
                        <p className="truncate text-xs text-muted-foreground">{g.faculty_name}</p>
                      </div>
                      <button onClick={() => { setEdit(g); setErr(""); }} aria-label="Tahrirlash" className="grid size-9 place-items-center rounded-lg border text-navy-700 hover:bg-navy-50"><Pencil size={15} /></button>
                      <button onClick={async () => { try { await removeGroup(g.id); reload(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } }} aria-label="O‘chirish" className="grid size-9 place-items-center rounded-lg border text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Pill tone="navy">{g.year}-kurs</Pill>
                      <Pill tone="blue">{g.language}</Pill>
                      <Pill tone={g.student_count ? "green" : "neutral"}>{g.student_count} talaba</Pill>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Kurator: <b className="text-navy-900">{g.curator_name ?? "biriktirilmagan"}</b></p>
                  </div>
                ))}
              </div>
            ) : <Empty icon={Users} title="Guruh yo‘q" />}
            {err && !edit && <div className="mt-4"><ErrorNote message={err} /></div>}
          </>
        )}

        {edit && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
            <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-navy-900">{edit.id ? `${edit.code} — tahrirlash` : "Yangi guruh"}</h2>
                <button type="button" onClick={() => setEdit(null)} aria-label="Yopish" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              {err && <ErrorNote message={err} />}
              {!edit.id && <label className="block text-sm font-medium">Guruh kodi<input name="code" required placeholder="IT103-26" className={`${field} mt-1.5 uppercase`} /></label>}
              <label className="block text-sm font-medium">Fakultet
                <select name="faculty" defaultValue={edit.faculty ?? faculties[0]?.id} className={`${field} mt-1.5`}>{faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Kurs<select name="year" defaultValue={edit.year ?? 1} className={`${field} mt-1.5`}>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}-kurs</option>)}</select></label>
                <label className="block text-sm font-medium">Ta’lim tili<select name="language" defaultValue={edit.language ?? "O‘zbek"} className={`${field} mt-1.5`}>{["O‘zbek", "Rus", "Ingliz"].map((y) => <option key={y}>{y}</option>)}</select></label>
              </div>
              <label className="block text-sm font-medium">Kurator
                <select name="curator" defaultValue={edit.curator ?? ""} className={`${field} mt-1.5`}><option value="">— Biriktirilmagan —</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullname}</option>)}</select>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEdit(null)} className="h-11 flex-1 rounded-xl border text-sm font-semibold hover:bg-slate-50">Bekor</button>
                <button disabled={busy} className="h-11 flex-1 rounded-xl bg-navy-700 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? "…" : "Saqlash"}</button>
              </div>
            </form>
          </div>
        )}
      </Page>
    </AdminPage>
  );
}
