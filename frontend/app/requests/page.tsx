"use client";

import { useState, type FormEvent } from "react";
import { Check, CheckCircle2, FilePlus2, MessageSquareText, Paperclip, Plus, Upload, X } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { createRequest, getRequests } from "@/lib/api-service";
import { Empty, ErrorNote, IconChip, Notice, Page, PageHeader, PageSkeleton, Pill, Segmented, useLoad, type Tone } from "@/components/mu/kit";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const DOCS: Record<string, string[]> = {
  "Ma’lumotnoma": [
    "O‘qish joyidan ma’lumotnoma",
    "Work & Travel xati",
    "Ta’lim tili / taxminiy bitirish xati",
    "To‘lov-kontrakt to‘lovlari haqida ma’lumotnoma",
  ],
  Ariza: [
    "Guruhni almashtirish",
    "Fakultetni almashtirish",
    "HEMIS bo‘yicha",
    "Darsdan favqulodda ruxsat",
    "Almashinuv dasturi",
    "Qayta tiklash",
    "Ko‘chirish",
    "Akademik ta’til",
    "Fanni qayta o‘qish",
    "Qayta topshirish",
    "Bepul qayta topshirish",
    "Imtihon muammosi",
    "Davomat",
    "Bo‘lib to‘lash",
    "Ortiqcha to‘lov",
    "Moliyaviy masalalar",
    "Texnik muammo",
    "Tilxat",
    "Shikoyat",
  ],
};
const LANGS = ["O‘zbekcha", "Ruscha", "Inglizcha"];
const STATUS: Record<string, [string, Tone, number]> = {
  new: ["Yuborildi", "blue", 0],
  processing: ["Ko‘rib chiqilmoqda", "amber", 1],
  ready: ["Tayyor", "green", 2],
  rejected: ["Rad etildi", "red", 2],
};
const STEPS = ["Yuborildi", "Ko‘rib chiqilmoqda", "Tayyor"];
const MAX_FILES = 5;
const MAX_MB = 15;

const field = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200";

export default function RequestsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => getRequests());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const [kind, setKind] = useState<"Ma’lumotnoma" | "Ariza">("Ma’lumotnoma");
  const [files, setFiles] = useState<File[]>([]);
  const [tab, setTab] = useState<"active" | "done">("active");

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    const big = next.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) return setFormError(`${big.name}: fayl ${MAX_MB} MB dan oshmasin.`);
    if (next.length > MAX_FILES) return setFormError(`Ko‘pi bilan ${MAX_FILES} ta fayl biriktirish mumkin.`);
    setFormError("");
    setFiles(next);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setFormError("");
    try {
      await createRequest({ ...Object.fromEntries(fd.entries()), kind, files: files.map((f) => f.name) });
      setOpen(false);
      setFiles([]);
      setDone(true);
      setTab("active");
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const all = (data ?? []) as any[];
  const rows = all.filter((r) => (tab === "active" ? r.status === "new" || r.status === "processing" : r.status === "ready" || r.status === "rejected"));

  return (
    <ProtectedRoute>
      <Page>
        <PageHeader
          eyebrow="Kampus"
          title="Murojaatlarim"
          description="Ma’lumotnoma oling yoki ariza yuboring — holatini shu yerda kuzating."
          actions={
            <button onClick={() => { setOpen(true); setDone(false); setFormError(""); }} className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white shadow-card transition hover:bg-navy-800">
              <Plus size={17} /> Yangi murojaat
            </button>
          }
        />
        {done && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
            <CheckCircle2 size={18} /> Murojaatingiz qabul qilindi. Holati o‘zgarganda bildirishnoma keladi.
          </div>
        )}
        <Segmented
          className="mb-5"
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Jarayonda", count: all.filter((r) => r.status === "new" || r.status === "processing").length },
            { value: "done", label: "Yakunlangan", count: all.filter((r) => r.status === "ready" || r.status === "rejected").length },
          ]}
        />
        {error ? (
          <ErrorNote message="Murojaatlar bo‘limi hozircha faqat demo rejimda mavjud." onRetry={reload} />
        ) : loading ? (
          <PageSkeleton rows={2} />
        ) : rows.length ? (
          <ul className="space-y-3">
            {rows.map((r) => {
              const [label, tone, step] = STATUS[r.status] ?? ["—", "neutral" as Tone, 0];
              return (
                <li key={r.id} className="rounded-2xl border bg-white p-4 shadow-card md:p-5">
                  <div className="flex items-start gap-4">
                    <IconChip icon={MessageSquareText} tone={tone} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-navy-900">{r.subject || r.type}</p>
                        <Pill tone="neutral">{r.kind ?? "Ma’lumotnoma"}</Pill>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.type}{r.language && ` · ${r.language}`}{r.purpose && ` · ${r.purpose}`}</p>
                      {r.description && <p className="mt-2 text-xs text-slate-600">{r.description}</p>}
                      {r.files?.length > 0 && (
                        <p className="mt-2 flex flex-wrap gap-1.5">
                          {r.files.map((f: string) => <span key={f} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600"><Paperclip size={11} />{f}</span>)}
                        </p>
                      )}
                    </div>
                    <Pill tone={tone} dot>{label}</Pill>
                  </div>
                  {/* Holat bosqichlari */}
                  <ol className="mt-4 flex items-center gap-2">
                    {STEPS.map((s, i) => (
                      <li key={s} className="flex flex-1 items-center gap-2">
                        <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold", i <= step ? (r.status === "rejected" && i === 2 ? "bg-rose-500 text-white" : "bg-navy-700 text-white") : "bg-slate-100 text-slate-400")}>
                          {i < step || (i === step && step === 2) ? <Check size={12} /> : i + 1}
                        </span>
                        <span className={cn("hidden text-[11px] sm:inline", i <= step ? "font-semibold text-navy-800" : "text-slate-400")}>{i === 2 && r.status === "rejected" ? "Rad etildi" : s}</span>
                        {i < 2 && <span className={cn("h-0.5 flex-1 rounded", i < step ? "bg-navy-700" : "bg-slate-200")} />}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-[11px] text-slate-400">Yuborilgan: {fmtDateTime(r.created_at)}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon={FilePlus2} title={tab === "active" ? "Jarayondagi murojaat yo‘q" : "Yakunlangan murojaat yo‘q"} text="Ma’lumotnoma yoki ariza kerak bo‘lsa, “Yangi murojaat” tugmasini bosing." />
        )}

        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Yangi murojaat">
            <form onSubmit={submit} className="thin-scroll max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-navy-900">Yangi murojaat</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              {formError && <ErrorNote message={formError} />}

              <div>
                <p className="mb-1.5 text-sm font-medium">Turi</p>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                  {(["Ma’lumotnoma", "Ariza"] as const).map((k) => (
                    <button type="button" key={k} onClick={() => setKind(k)} className={cn("h-10 rounded-xl text-sm font-semibold transition", kind === k ? "bg-white text-navy-900 shadow-sm" : "text-slate-500")}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-medium">{kind === "Ariza" ? "Ariza mavzusi" : "Hujjat"} <span className="text-rose-500">*</span>
                <select key={kind} name="document" required defaultValue="" className={`${field} mt-1.5`}>
                  <option value="" disabled>— Tanlang —</option>
                  {DOCS[kind].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              {kind === "Ma’lumotnoma" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">Hujjat tili
                    <select name="language" className={`${field} mt-1.5`}>{LANGS.map((t) => <option key={t}>{t}</option>)}</select>
                  </label>
                  <label className="block text-sm font-medium">Maqsad
                    <input name="purpose" placeholder="bank, elchixona…" className={`${field} mt-1.5`} />
                  </label>
                </div>
              )}
              <label className="block text-sm font-medium">Telefon <span className="text-rose-500">*</span>
                <input name="phone" type="tel" required defaultValue={user?.phone_number ?? ""} className={`${field} mt-1.5`} />
              </label>
              <label className="block text-sm font-medium">Mavzu
                <input name="subject" placeholder="Murojaatingizni qisqacha yozing" className={`${field} mt-1.5`} />
              </label>
              <label className="block text-sm font-medium">Tavsif
                <textarea name="description" rows={3} className={`${field} mt-1.5 h-auto py-2.5`} placeholder="Murojaatingizni batafsil yozing" />
              </label>
              <div>
                <p className="text-sm font-medium">Ilova fayllar <span className="font-normal text-muted-foreground">(ixtiyoriy)</span></p>
                <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/40 px-4 py-4 text-sm font-semibold text-navy-700 hover:border-gold-400 hover:bg-gold-50">
                  <Upload size={16} /> Fayl qo‘shish
                  <input type="file" multiple accept="image/*,.pdf,.doc,.docx" className="sr-only" onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground">{MAX_FILES} tagacha fayl, har biri {MAX_MB} MB gacha. Rasm, PDF va hujjatlar.</p>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <Paperclip size={13} className="text-slate-400" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="text-slate-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Olib tashlash" className="text-slate-400 hover:text-rose-600"><X size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Notice tone="gold">Demo rejimda murojaat faqat shu sessiya davomida saqlanadi.</Notice>
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
