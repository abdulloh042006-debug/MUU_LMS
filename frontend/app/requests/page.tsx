"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, FilePlus2, MessageSquareText, Plus, X } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { createRequest, getRequests } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Notice, Page, PageHeader, PageSkeleton, Pill, useLoad, type Tone } from "@/components/mu/kit";
import { fmtDateTime } from "@/lib/format";

const TYPES = ["Talabalik ma’lumotnomasi", "Akademik ma’lumotnoma", "Transkript", "Stipendiya ma’lumotnomasi", "Boshqa"];
const LANGS = ["O‘zbek", "Rus", "Ingliz"];
const STATUS: Record<string, [string, Tone]> = {
  new: ["Yangi", "blue"],
  processing: ["Ko‘rib chiqilmoqda", "amber"],
  ready: ["Tayyor", "green"],
  rejected: ["Rad etildi", "red"],
};

const field = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200";

export default function RequestsPage() {
  const { data, loading, error, reload } = useLoad(() => getRequests());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setFormError("");
    try {
      await createRequest(Object.fromEntries(fd.entries()));
      setOpen(false);
      setDone(true);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const rows = (data ?? []) as any[];

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader
          eyebrow="Universitet"
          title="Murojaatlar"
          description="Ma’lumotnoma va hujjatlarga buyurtma bering, holatini kuzating."
          actions={
            <button onClick={() => { setOpen(true); setDone(false); }} className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white shadow-card transition hover:bg-navy-800">
              <Plus size={17} /> Yangi murojaat
            </button>
          }
        />
        {done && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
            <CheckCircle2 size={18} /> Murojaatingiz qabul qilindi. Holatini shu sahifadan kuzatib borishingiz mumkin.
          </div>
        )}
        {error ? (
          <ErrorNote message="Murojaatlar bo‘limi hozircha faqat demo rejimda mavjud." onRetry={reload} />
        ) : loading ? (
          <PageSkeleton rows={2} />
        ) : rows.length ? (
          <ul className="space-y-3">
            {rows.map((r) => {
              const [label, tone] = STATUS[r.status] ?? ["—", "neutral" as Tone];
              return (
                <li key={r.id} className="flex items-start gap-4 rounded-2xl border bg-white p-4 shadow-card md:p-5">
                  <IconChip icon={MessageSquareText} tone={tone} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900">{r.subject || r.type}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.type} · {r.language}{r.purpose && ` · ${r.purpose}`}</p>
                    {r.description && <p className="mt-2 text-xs text-slate-600">{r.description}</p>}
                    <p className="mt-2 text-[11px] text-slate-400">Yuborilgan: {fmtDateTime(r.created_at)}</p>
                  </div>
                  <Pill tone={tone} dot>{label}</Pill>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon={FilePlus2} title="Hali murojaat yo‘q" text="Ma’lumotnoma kerak bo‘lsa, “Yangi murojaat” tugmasini bosing." />
        )}

        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Yangi murojaat">
            <form onSubmit={submit} className="thin-scroll max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-navy-900">Yangi murojaat</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <Notice tone="gold">Demo rejimda yuborilgan murojaat faqat shu sessiya davomida saqlanadi.</Notice>
              {formError && <ErrorNote message={formError} />}
              <label className="block text-sm font-medium">Hujjat turi
                <select name="type" className={`${field} mt-1.5`} required>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Til
                  <select name="language" className={`${field} mt-1.5`}>{LANGS.map((t) => <option key={t}>{t}</option>)}</select>
                </label>
                <label className="block text-sm font-medium">Maqsad
                  <input name="purpose" placeholder="Masalan: bank" className={`${field} mt-1.5`} />
                </label>
              </div>
              <label className="block text-sm font-medium">Mavzu
                <input name="subject" required placeholder="Qisqa sarlavha" className={`${field} mt-1.5`} />
              </label>
              <label className="block text-sm font-medium">Izoh
                <textarea name="description" rows={3} className={`${field} mt-1.5 h-auto py-2.5`} placeholder="Qo‘shimcha ma’lumot…" />
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="h-11 flex-1 rounded-xl border text-sm font-semibold hover:bg-slate-50">Bekor qilish</button>
                <button disabled={busy} className="h-11 flex-1 rounded-xl bg-navy-700 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? "Yuborilmoqda…" : "Yuborish"}</button>
              </div>
            </form>
          </div>
        )}
      </Page>
    </ProtectedRoute>
  );
}
